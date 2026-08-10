#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Генератор каталога для сайта.

Сканирует папку csd/ и собирает товары по правилу:
  - имя папки              = название модели
  - картинки внутри папки  = фотографии товара (jpg, png, webp, svg, ...)
  - текстовый файл (.txt)  = ссылка на товар (первая найденная http-ссылка)

Дополнительно в .txt можно указать (необязательно):
  Цена: 15990
  Описание: любой текст
  Категория: Запчасти

Подпапка с папками внутри (например csd/Запчасти/Колёса 110 мм/) считается
категорией: её имя становится категорией всех товаров внутри.

Если в csd/ товаров нет, берутся примеры из csd-demo/, чтобы сайт не был пустым.

Результат пишется в catalog.js (его читает сайт) и catalog.json (для проверки).
Запуск:  python3 build_catalog.py
"""

import json
import re
import sys
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif", ".bmp"}
TEXT_EXTS = {".txt", ".url", ".website", ".md", ""}
MAX_IMAGES_PER_PRODUCT = 12
MAX_DEPTH = 4

URL_RE = re.compile(r"https?://[^\s\"'<>]+")
PRICE_RE = re.compile(r"(?:цена|price)\s*[:=]\s*([\d\s.,]{1,20})", re.IGNORECASE)
DESC_RE = re.compile(r"(?:описание|description)\s*[:=]\s*(.+)", re.IGNORECASE)
CAT_RE = re.compile(r"(?:категория|category)\s*[:=]\s*(.+)", re.IGNORECASE)

PARTS_NAMES = {"запчасти", "запчасть", "parts", "зч", "комплектующие"}

# Автоопределение категории по ключевым словам в названии папки
# (для товаров с китайских маркетплейсов вроде Taobao/1688).
NAME_CATEGORIES = [
    ("整车", "Самокаты"),
    ("轮子", "Колёса"),
    ("底板", "Деки"),
    ("车把", "Рули и грипсы"),
    ("把套", "Рули и грипсы"),
    ("把夹", "Рули и грипсы"),
    ("前叉", "Вилки"),
    ("护具", "Защита"),
    ("头盔", "Защита"),
    ("碗组", "Запчасти"),
    ("刹车", "Запчасти"),
    ("砂纸", "Запчасти"),
    ("蜡", "Запчасти"),
    ("垫圈", "Запчасти"),
    ("钢炮", "Запчасти"),
]

# Служебный хвост в имени папки вида «-750y» (внутренняя пометка цены) —
# на сайте не показывается.
PRICE_TAIL_RE = re.compile(r"[-–—]\s*\d+\s*[yYуУ]$")


def display_name(raw: str) -> str:
    return PRICE_TAIL_RE.sub("", raw.strip()).strip()


def category_from_name(name: str):
    for keyword, category in NAME_CATEGORIES:
        if keyword in name:
            return category
    return None


def natural_key(value):
    """Ключ для «человеческой» сортировки: фото2 раньше, чем фото10."""
    name = value.name if isinstance(value, Path) else str(value)
    return [int(part) if part.isdigit() else part.casefold()
            for part in re.split(r"(\d+)", name)]


def read_text_smart(path: Path) -> str:
    """Читает текстовый файл: UTF-8, а если не вышло — Windows-1251 (Блокнот)."""
    try:
        data = path.read_bytes()
    except OSError:
        return ""
    if len(data) > 200_000:  # явно не файл со ссылкой
        return ""
    for encoding in ("utf-8-sig", "cp1251"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def parse_price(raw: str):
    digits = re.sub(r"\D", "", raw)
    return int(digits) if digits else None


def parse_meta(folder: Path) -> dict:
    """Собирает ссылку, цену, описание и категорию из текстовых файлов папки."""
    meta = {"link": "", "price": None, "description": "", "category": ""}
    leftovers = []
    for file in sorted(folder.iterdir(), key=natural_key):
        if not file.is_file() or file.suffix.lower() not in TEXT_EXTS:
            continue
        text = read_text_smart(file)
        if not text:
            continue
        file_has_url = False
        file_leftovers = []
        for line in text.splitlines():
            line = line.strip()
            if not line:
                continue
            url = URL_RE.search(line)
            price = PRICE_RE.search(line)
            desc = DESC_RE.search(line)
            cat = CAT_RE.search(line)
            if url:
                file_has_url = True
                if not meta["link"]:
                    meta["link"] = url.group(0).rstrip(".,);")
            if price and meta["price"] is None:
                meta["price"] = parse_price(price.group(1))
            if desc and not meta["description"]:
                meta["description"] = desc.group(1).strip()
            if cat and not meta["category"]:
                meta["category"] = cat.group(1).strip()
            if not (url or price or desc or cat) and not line.lower().startswith(("[internetshortcut]", "iconindex", "iconfile")):
                file_leftovers.append(line)
        # Файл со ссылкой (например, шаблон «поделиться» с Taobao) — служебный
        # текст из него в описание не берём.
        if not file_has_url:
            leftovers.extend(file_leftovers)
    if not meta["description"] and leftovers:
        meta["description"] = " ".join(leftovers)[:300].strip()
    return meta


def normalize_category(name: str) -> str:
    clean = name.strip()
    if clean.casefold() in PARTS_NAMES:
        return "Запчасти"
    if clean.casefold() in {"csd", "самокаты", "scooters"}:
        return "Самокаты"
    return clean


def folder_images(folder: Path):
    return sorted(
        (f for f in folder.iterdir()
         if f.is_file() and f.suffix.lower() in IMAGE_EXTS and f.stat().st_size > 0),
        key=natural_key,
    )


def collect_products(base: Path):
    products = []
    if not base.is_dir():
        return products

    def walk(folder: Path, category, depth: int):
        if depth > MAX_DEPTH:
            return
        images = folder_images(folder)
        meta = parse_meta(folder)
        subdirs = [d for d in sorted(folder.iterdir(), key=natural_key)
                   if d.is_dir() and not d.name.startswith((".", "_"))]

        if images or meta["link"]:
            resolved_category = (meta["category"] or category
                                 or category_from_name(folder.name) or "Самокаты")
            products.append({
                "name": display_name(folder.name),
                "category": normalize_category(resolved_category),
                "images": [quote(f.relative_to(ROOT).as_posix())
                           for f in images[:MAX_IMAGES_PER_PRODUCT]],
                "link": meta["link"],
                "price": meta["price"],
                "description": meta["description"],
            })
            return

        # Папка без фото и ссылки — считаем её категорией и идём внутрь.
        next_category = category or normalize_category(folder.name)
        for sub in subdirs:
            walk(sub, next_category, depth + 1)

    for entry in sorted(base.iterdir(), key=natural_key):
        if entry.is_dir() and not entry.name.startswith((".", "_")):
            walk(entry, None, 1)
    return products


# Пересчёт цен из юаней в доллары
# (файл prices.json: {"название товара как на сайте": цена_в_юанях}).
YUAN_PER_USD = 7.2   # курс юаня к доллару
MARKUP = 1.0         # наценка: 1.0 = без наценки, 1.3 = +30%


def load_display_names():
    """names.json: {"имя папки (без ценового хвоста)": "красивое название"}."""
    names_file = ROOT / "names.json"
    if not names_file.exists():
        return {}
    try:
        return json.loads(names_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def apply_display_names(products):
    names = load_display_names()
    if not names:
        return
    for product in products:
        nice = names.get(product["name"])
        if nice:
            product["name"] = nice


def load_yuan_prices():
    prices_file = ROOT / "prices.json"
    if not prices_file.exists():
        return {}
    try:
        return json.loads(prices_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def apply_yuan_prices(products):
    yuan_prices = load_yuan_prices()
    if not yuan_prices:
        return
    for product in products:
        if product["price"] is not None:
            continue
        yuan = yuan_prices.get(product["name"])
        if isinstance(yuan, (int, float)) and yuan > 0:
            product["price"] = round(yuan / YUAN_PER_USD * MARKUP)


def main():
    source = ROOT / "csd"
    products = collect_products(source)
    demo = False
    if not products:
        products = collect_products(ROOT / "csd-demo")
        demo = True
    apply_yuan_prices(products)
    apply_display_names(products)

    products.sort(key=lambda p: (p["category"] != "Самокаты",
                                 p["category"].casefold(),
                                 natural_key(p["name"])))
    for index, product in enumerate(products):
        product["id"] = index

    catalog = {"demo": demo, "products": products}
    payload = json.dumps(catalog, ensure_ascii=False, indent=2)
    (ROOT / "catalog.json").write_text(payload + "\n", encoding="utf-8")
    (ROOT / "catalog.js").write_text(
        "// Файл создан автоматически скриптом build_catalog.py — не редактируйте вручную.\n"
        "window.CATALOG = " + payload + ";\n",
        encoding="utf-8",
    )

    categories = {}
    for product in products:
        categories[product["category"]] = categories.get(product["category"], 0) + 1
    summary = ", ".join(f"{name}: {count}" for name, count in categories.items()) or "пусто"
    origin = "csd-demo (примеры)" if demo else "csd"
    print(f"Каталог собран из папки {origin}. Товаров: {len(products)} ({summary})")
    if demo:
        print("Чтобы показать свои товары, загрузите папки моделей в csd/ и запустите скрипт снова.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Импорт товаров из папки CSD на Google Диске в папку csd/ репозитория.

Папка на Диске должна быть открыта «всем, у кого есть ссылка» (просмотр).

Скрипт работает бережно к лимитам Google: получает список файлов, потом
скачивает их ПО ОДНОМУ с паузами и повторными попытками. Уже скачанное
пропускается, поэтому при сбое достаточно запустить импорт ещё раз —
он дозаберёт остальное.

Фотографии сжимаются (скриншоты по 5–8 МБ превращаются в JPEG до 1200px),
берётся не больше 6 фото на товар. Результат: csd/<название товара>/.

Запускается через GitHub Actions (import-drive.yml).
"""

import re
import shutil
import sys
import time
from collections import defaultdict
from pathlib import Path

import gdown
import requests
from PIL import Image

DRIVE_FOLDER_ID = "1ZSCKgmYmVNCdaM7_OqLqWIBxLJFRCYLV"
ROOT = Path(__file__).resolve().parent
DOWNLOAD_DIR = ROOT / "_drive_csd"
TARGET_DIR = ROOT / "csd"

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
TEXT_EXTS = {".txt", ".url", ".md", ".website"}
MAX_IMAGES_PER_PRODUCT = 12
MAX_SIDE = 1600
JPEG_QUALITY = 87
DOWNLOAD_PAUSE = 1.5      # пауза между файлами, сек
RETRIES = 3               # попыток на файл
RETRY_PAUSE = 25          # пауза перед повторной попыткой, сек


def natural_key(name: str):
    return [int(part) if part.isdigit() else part.casefold()
            for part in re.split(r"(\d+)", name)]


def list_drive_files():
    """Список файлов папки на Диске (без скачивания), с повторами."""
    for attempt in range(1, RETRIES + 1):
        try:
            entries = gdown.download_folder(
                id=DRIVE_FOLDER_ID,
                output=str(DOWNLOAD_DIR),
                skip_download=True,
                quiet=True,
                use_cookies=False,
            )
            if entries:
                return entries
        except Exception as error:
            print(f"Не удалось получить список файлов (попытка {attempt}): {error}")
        time.sleep(RETRY_PAUSE)
    return None


def compress_image(source: Path, target: Path) -> None:
    with Image.open(source) as img:
        img = img.convert("RGB")
        img.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        target.parent.mkdir(parents=True, exist_ok=True)
        img.save(target, "JPEG", quality=JPEG_QUALITY, optimize=True)


def download_thumbnail(file_id: str, tmp_path: Path) -> bool:
    """Миниатюра Google Диска (до 1200px) — отдельный канал, который
    обычно не попадает под лимиты массового скачивания."""
    url = f"https://drive.google.com/thumbnail?id={file_id}&sz=w{MAX_SIDE}"
    for attempt in (1, 2):
        try:
            response = requests.get(url, timeout=60, allow_redirects=True)
            content_type = response.headers.get("content-type", "")
            if (response.status_code == 200 and content_type.startswith("image/")
                    and len(response.content) > 5000):
                tmp_path.write_bytes(response.content)
                return True
        except Exception as error:
            print(f"    миниатюра, попытка {attempt}: {error}")
        time.sleep(3)
    return False


def download_one(file_id: str, tmp_path: Path, is_image: bool) -> bool:
    tmp_path.parent.mkdir(parents=True, exist_ok=True)
    # Для картинок сначала пробуем миниатюру — быстро и без лимитов.
    if is_image and download_thumbnail(file_id, tmp_path):
        return True
    for attempt in range(1, RETRIES + 1):
        try:
            result = gdown.download(id=file_id, output=str(tmp_path),
                                    quiet=True, use_cookies=False)
            if result and tmp_path.exists() and tmp_path.stat().st_size > 0:
                return True
        except Exception as error:
            print(f"    попытка {attempt} не удалась: {error}")
        if attempt < RETRIES:
            time.sleep(RETRY_PAUSE)
    return False


def main() -> int:
    print(f"Получаю список файлов папки CSD (id={DRIVE_FOLDER_ID})...")
    entries = list_drive_files()
    if not entries:
        print("ОШИБКА: не удалось получить список файлов. Проверьте, что папка "
              "CSD открыта «всем, у кого есть ссылка», и запустите импорт позже.")
        return 1

    # Группируем файлы по товарам (первая часть относительного пути).
    products = defaultdict(list)
    for entry in entries:
        relative = Path(entry.local_path).relative_to(DOWNLOAD_DIR)
        if len(relative.parts) < 2:
            continue  # файл в корне папки CSD — не товар
        product = relative.parts[0].strip()
        products[product].append((entry.id, relative.parts[-1]))

    print(f"Найдено товаров: {len(products)}")
    TARGET_DIR.mkdir(exist_ok=True)

    planned = []  # (file_id, имя файла на Диске, конечный путь, это фото?)
    for product, files in sorted(products.items(), key=lambda p: natural_key(p[0])):
        files.sort(key=lambda item: natural_key(item[1]))
        image_index = 0
        for file_id, filename in files:
            suffix = Path(filename).suffix.lower()
            if suffix in IMAGE_EXTS and image_index < MAX_IMAGES_PER_PRODUCT:
                image_index += 1
                target = TARGET_DIR / product / f"{image_index:02d}.jpg"
                planned.append((file_id, filename, target, True))
            elif suffix in TEXT_EXTS:
                target = TARGET_DIR / product / filename
                planned.append((file_id, filename, target, False))

    todo = [item for item in planned if not item[2].exists()]
    print(f"Файлов в плане: {len(planned)}, уже скачано: "
          f"{len(planned) - len(todo)}, осталось: {len(todo)}")

    downloaded = 0
    failed = 0
    for file_id, filename, target, is_image in todo:
        tmp_path = DOWNLOAD_DIR / "tmp" / filename
        print(f"  {target.parent.name} / {filename}")
        if not download_one(file_id, tmp_path, is_image):
            failed += 1
            print("    НЕ СКАЧАЛСЯ — заберём при следующем запуске")
            continue
        try:
            if is_image:
                compress_image(tmp_path, target)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(tmp_path, target)
            downloaded += 1
        except Exception as error:
            failed += 1
            print(f"    файл повреждён, пропускаю: {error}")
        finally:
            tmp_path.unlink(missing_ok=True)
        time.sleep(DOWNLOAD_PAUSE)

    shutil.rmtree(DOWNLOAD_DIR, ignore_errors=True)
    print(f"Итог: скачано сейчас {downloaded}, не удалось {failed}, "
          f"всего готово {len(planned) - len(todo) + downloaded} из {len(planned)}.")
    if failed:
        print("Часть файлов Google не отдал (лимит скачиваний). Запустите "
              "импорт ещё раз через 10–30 минут — он дозаберёт остальное.")
    # Частичный результат — тоже результат: коммитим то, что скачалось.
    return 0


if __name__ == "__main__":
    sys.exit(main())

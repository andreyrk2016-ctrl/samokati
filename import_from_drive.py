#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Импорт товаров из папки CSD на Google Диске в папку csd/ репозитория.

Папка на Диске должна быть открыта «всем, у кого есть ссылка» (просмотр).
Скрипт скачивает все подпапки с товарами, сжимает фотографии
(скриншоты по 5–8 МБ превращаются в JPEG ~1200px по длинной стороне)
и раскладывает результат в csd/<название товара>/.

Запускается автоматически через GitHub Actions (import-drive.yml).
"""

import re
import shutil
import sys
from pathlib import Path

import gdown
from PIL import Image

DRIVE_FOLDER_ID = "1ZSCKgmYmVNCdaM7_OqLqWIBxLJFRCYLV"
ROOT = Path(__file__).resolve().parent
DOWNLOAD_DIR = ROOT / "_drive_csd"
TARGET_DIR = ROOT / "csd"
KEEP_FILES = {"ПРОЧИТАЙ-МЕНЯ.txt"}

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
MAX_SIDE = 1200
JPEG_QUALITY = 82


def natural_key(path: Path):
    return [int(part) if part.isdigit() else part.casefold()
            for part in re.split(r"(\d+)", path.name)]


def compress_image(source: Path, target: Path) -> None:
    with Image.open(source) as img:
        img = img.convert("RGB")
        img.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        img.save(target, "JPEG", quality=JPEG_QUALITY, optimize=True)


def main() -> int:
    if DOWNLOAD_DIR.exists():
        shutil.rmtree(DOWNLOAD_DIR)

    print(f"Скачиваю папку CSD с Google Диска (id={DRIVE_FOLDER_ID})...")
    result = gdown.download_folder(
        id=DRIVE_FOLDER_ID,
        output=str(DOWNLOAD_DIR),
        quiet=False,
        use_cookies=False,
    )
    if not result:
        print("ОШИБКА: не удалось скачать папку. Проверьте, что папка CSD на "
              "Google Диске открыта «всем, у кого есть ссылка».")
        return 1

    product_dirs = sorted((d for d in DOWNLOAD_DIR.iterdir() if d.is_dir()),
                          key=natural_key)
    if not product_dirs:
        print("ОШИБКА: в скачанной папке нет подпапок с товарами.")
        return 1

    # Очищаем старое содержимое csd/, кроме служебных файлов.
    TARGET_DIR.mkdir(exist_ok=True)
    for item in TARGET_DIR.iterdir():
        if item.name in KEEP_FILES:
            continue
        shutil.rmtree(item) if item.is_dir() else item.unlink()

    total_images = 0
    for src_dir in product_dirs:
        dst_dir = TARGET_DIR / src_dir.name.strip()
        dst_dir.mkdir(parents=True, exist_ok=True)
        image_index = 0
        for file in sorted(src_dir.iterdir(), key=natural_key):
            if not file.is_file():
                continue
            suffix = file.suffix.lower()
            if suffix in IMAGE_EXTS:
                image_index += 1
                target = dst_dir / f"{image_index:02d}.jpg"
                try:
                    compress_image(file, target)
                    total_images += 1
                except Exception as error:  # битый файл — пропускаем
                    print(f"  пропущено {file.name}: {error}")
            elif suffix in {".txt", ".url", ".md", ".website"}:
                shutil.copyfile(file, dst_dir / file.name)
        print(f"  {src_dir.name}: {image_index} фото")

    shutil.rmtree(DOWNLOAD_DIR)
    print(f"Готово: {len(product_dirs)} товаров, {total_images} фото (сжаты до "
          f"{MAX_SIDE}px JPEG).")
    return 0


if __name__ == "__main__":
    sys.exit(main())

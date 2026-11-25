#!/usr/bin/env python3
"""Пакет заказов из таблицы: по ролику на каждого ребёнка (группа детсада, класс, дети сотрудников).

  python3 studio/batch.py studio/orders/группа.csv [--tts eleven] [--only final]

CSV (разделитель запятая или точка с запятой), первая строка — заголовки:
  name, gender (м/ж), age, fact1, fact2, fact3, advice, gift, from
Лишние столбцы игнорируются, пустые ячейки допустимы. Удобно выгрузить из Google Таблицы/Формы.
"""
import argparse, csv, os, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import make_video  # noqa: E402

ALIASES = {"имя": "name", "пол": "gender", "возраст": "age", "наказ": "advice", "подарок": "gift",
           "желание": "gift", "привет": "from", "от кого": "from", "факт1": "fact1", "факт2": "fact2",
           "факт3": "fact3", "факт 1": "fact1", "факт 2": "fact2", "факт 3": "fact3"}


def main():
    ap = argparse.ArgumentParser(description="Пакет видеопоздравлений из CSV")
    ap.add_argument("csv")
    ap.add_argument("--tts", default="eleven", choices=["eleven", "eleven_turbo", "yandex"])
    ap.add_argument("--only", choices=["preview", "final"])
    ap.add_argument("--brand")
    a = ap.parse_args()

    with open(a.csv, encoding="utf-8-sig", newline="") as f:
        sample = f.read(4096)
        f.seek(0)
        delim = ";" if sample.count(";") > sample.count(",") else ","
        rows = list(csv.DictReader(f, delimiter=delim))
    base = os.path.join(HERE, "out", time.strftime("%m%d-%H%M") + "-" +
                        make_video.slugify(os.path.splitext(os.path.basename(a.csv))[0]))
    done, failed = 0, []
    for i, raw in enumerate(rows, 1):
        row = {ALIASES.get(k.strip().lower(), k.strip().lower()): (v or "").strip() for k, v in raw.items() if k}
        if not row.get("name"):
            continue
        order = {"name": row["name"],
                 "gender": "f" if row.get("gender", "").lower().startswith(("f", "ж", "д")) else "m",
                 "facts": [row[k] for k in ("fact1", "fact2", "fact3") if row.get(k)]}
        if row.get("age", "").isdigit():
            order["age"] = int(row["age"])
        for k in ("advice", "gift", "from"):
            if row.get(k):
                order[k] = row[k]
        out = os.path.join(base, f"{i:02d}-{make_video.slugify(row['name'])}")
        try:
            res = make_video.build(order, out, provider=a.tts, brand=a.brand, only=a.only)
            done += 1
            print(f"[{i}/{len(rows)}] {row['name']}: готово, {res['total']:.0f} с", flush=True)
        except SystemExit as e:
            failed.append(row["name"])
            print(f"[{i}/{len(rows)}] {row['name']}: ОШИБКА — {e}", flush=True)
    print(f"\nГотово роликов: {done}. Папка: {base}")
    if failed:
        print("Не получилось:", ", ".join(failed))


if __name__ == "__main__":
    main()

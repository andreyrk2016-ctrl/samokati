#!/usr/bin/env python3
"""Именное видеопоздравление от Деда Мороза: анкета -> готовый MP4.

Примеры:
  python3 studio/make_video.py studio/orders/misha.json
  python3 studio/make_video.py --name Миша --age 6 --gender m \\
      --fact "научился кататься на велосипеде" --fact "помогаешь маме" --gift "большой конструктор"
  python3 studio/make_video.py studio/orders/misha.json --text      # только показать текст, без затрат

На выходе в studio/out/<заказ>/:
  ОБРАЗЕЦ_Дед-Мороз_<имя>.mp4 — с водяным знаком (отправляем до оплаты)
  Дед-Мороз_<имя>.mp4         — чистый ролик (отправляем после оплаты)
  script.txt    — текст поздравления
"""
import argparse, hashlib, json, os, re, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import script as scriptlib          # noqa: E402
from lib import tts                 # noqa: E402

A = os.path.join(HERE, "assets")
CLIPS = {  # сцена -> список дублей (файл, длительность)
    "terem": ["terem.mp4"], "book": ["book.mp4"], "gifts": ["gifts.mp4"],
    "troika": ["troika.mp4"], "elka": ["elka.mp4"],
    "ded": ["ded_talk.mp4", "ded_nod.mp4"],
}
W, H, FPS = 720, 1280, 24
X = 0.5            # длительность перехода между планами, с
INTRO = 2.0        # музыка и заставка до первых слов, с
GAP = 0.45         # пауза между фразами, с
LEAD = 0.55        # от начала сцены до голоса, с
TAIL = 3.2         # после последних слов, с
VOICE_DB = -19.0   # к этой средней громкости приводим каждую фразу, дБ
MUSIC_DB = 1.0     # громкость музыки, дБ (под голосом приглушается автоматически)
MASTER_DB = 2.0    # общая громкость на выходе, дБ


def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode != 0:
        sys.stderr.write((r.stderr or "")[-3000:])
        raise SystemExit(f"Команда упала: {' '.join(cmd[:6])} ...")
    return r


def dur(path):
    r = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path])
    return float(r.stdout.strip())


def mean_db(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", "volumedetect", "-f", "null", "-"],
                       capture_output=True, text=True)
    m = re.search(r"mean_volume:\s*(-?[\d.]+) dB", r.stderr)
    return float(m.group(1)) if m else -19.0


def slugify(s):
    tr = dict(zip("абвгдеёжзийклмнопрстуфхцчшщъыьэюя",
                  ["a", "b", "v", "g", "d", "e", "e", "zh", "z", "i", "y", "k", "l", "m", "n", "o", "p", "r", "s",
                   "t", "u", "f", "h", "c", "ch", "sh", "sch", "", "y", "", "e", "yu", "ya"]))
    out = "".join(tr.get(ch, ch) for ch in s.lower())
    return re.sub(r"[^a-z0-9]+", "-", out).strip("-") or "order"


def synth(text, provider, cache_dir):
    """Озвучка с кэшем: повторная сборка того же текста не тратит кредиты."""
    key = hashlib.sha1(f"{provider}|{text}".encode()).hexdigest()[:20]
    path = os.path.join(cache_dir, f"{key}.mp3")
    if os.path.exists(path) and os.path.getsize(path) > 1000:
        return path
    if provider == "eleven":
        tts.eleven(text, path)
    elif provider == "eleven_turbo":
        tts.eleven(text, path, model="eleven_v4_turbo")
    elif provider == "yandex":
        tts.yandex(text, path)
    else:
        raise SystemExit(f"неизвестная озвучка: {provider}")
    return path


def plan_takes(scene, visible, first_take=0):
    """Раскладывает сцену нужной длины по дублям. Возвращает [(файл, видимая длительность, speed)]."""
    takes = CLIPS[scene]
    caps = [dur(os.path.join(A, "clips", t)) for t in takes]
    need = visible + X                       # с запасом на переход
    if len(takes) == 1:
        speed = 1.0 if need <= caps[0] else caps[0] / need     # не хватает — чуть замедляем
        return [(takes[0], visible, speed)]
    n = 1
    while visible / n + X > min(caps) - 0.1:
        n += 1
    return [(takes[(first_take + i) % len(takes)], visible / n, 1.0) for i in range(n)]


def build(order, out_dir, provider="eleven", brand=None, only=None, keep=False):
    os.makedirs(out_dir, exist_ok=True)
    cache = os.path.join(HERE, ".cache", "tts")
    os.makedirs(cache, exist_ok=True)
    work = os.path.join(out_dir, "_work")
    os.makedirs(work, exist_ok=True)

    segs = scriptlib.build(order)
    with open(os.path.join(out_dir, "script.txt"), "w", encoding="utf8") as f:
        f.write(scriptlib.plain_text(segs) + "\n")

    # --- озвучка ---
    chars = 0
    for s in segs:
        s["audio"] = synth(s["text"], provider, cache)
        s["dur"] = dur(s["audio"])
        chars += len(s["text"])

    # --- раскладка по времени: соседние фразы одной сцены идут одним планом ---
    blocks = []
    for s in segs:
        if blocks and blocks[-1]["scene"] == s["scene"]:
            blocks[-1]["segs"].append(s)
        else:
            blocks.append({"scene": s["scene"], "segs": [s]})
    t = 0.0
    for bi, b in enumerate(blocks):
        b["start"] = t
        t += INTRO if bi == 0 else LEAD
        for s in b["segs"]:
            s["start"] = t
            t += s["dur"] + GAP
        t += -GAP + (TAIL if bi == len(blocks) - 1 else 0.35)
        b["end"] = t
    total = t

    # --- видеоряд: планы и переходы ---
    pieces, ded_seen = [], 0
    for b in blocks:
        first = 0
        if b["scene"] == "ded":
            first = ded_seen % 2
            ded_seen += 1
        for clip, vis, speed in plan_takes(b["scene"], b["end"] - b["start"], first):
            pieces.append({"clip": clip, "vis": vis, "speed": speed})
    n = len(pieces)
    for i, p in enumerate(pieces):
        p["len"] = p["vis"] + (X / 2 if i in (0, n - 1) else X) if n > 1 else p["vis"]

    # --- плашки ---
    cards, timed = [], []          # timed: (png, start, end)

    def add_card(card, start, end, tag):
        fn = f"card_{len(cards):02d}_{tag}.png"
        c = dict(card)
        c["file"] = fn
        cards.append(c)
        timed.append((os.path.join(work, fn), start, end))

    for b in blocks:
        for s in b["segs"]:
            card = s.get("card")
            if not card:
                continue
            c = {k: v for k, v in card.items() if v is not None}
            if c["type"] == "title":
                add_card(c, 0.0, b["end"] - 0.15, "title")
            elif c["type"] == "finale":
                if brand:
                    c["brand"] = brand
                add_card(c, s["start"] + 0.3, total - 0.2, "finale")
            elif c["type"] == "facts" and s.get("reveal"):
                # панель стоит всё время, строки появляются по мере того, как Дед Мороз их называет
                full = len(s["text"])
                end = min(b["end"] - 0.2, s["start"] + s["dur"] + 2.2)
                bg = dict(c)
                bg["part"] = "bg"
                add_card(bg, s["start"] + 0.1, end, "facts_bg")
                pos = 0
                for i, part in enumerate(s["reveal"]):
                    line = dict(c)
                    line["part"] = i
                    add_card(line, s["start"] + s["dur"] * (pos / full) + 0.45, end, f"facts{i + 1}")
                    pos += len(part) + 1
            else:
                st = s["start"] + (0.9 if c["type"] == "name" else 1.6)
                add_card(c, st, min(b["end"] - 0.2, s["start"] + s["dur"] + 1.5), c["type"])
    if only != "final":
        cards.append({"file": "wm.png", "type": "watermark"})
    spec = os.path.join(work, "cards.json")
    with open(spec, "w", encoding="utf8") as f:
        json.dump({"outDir": work, "cards": cards}, f, ensure_ascii=False)
    run(["node", os.path.join(HERE, "overlays", "render.mjs"), spec])

    # --- ffmpeg ---
    inputs, fc = [], []

    def add_input(*args):
        inputs.extend(args)
        return (len([a for a in inputs if a == "-i"]) - 1)

    # видео-планы
    labels = []
    for i, p in enumerate(pieces):
        idx = add_input("-i", os.path.join(A, "clips", p["clip"]))
        src_len = p["len"] * p["speed"]
        chain = f"[{idx}:v]trim=0:{src_len:.3f},setpts=(PTS-STARTPTS)/{p['speed']:.5f}," \
                f"fps={FPS},scale={W}:{H},format=yuv420p,settb=AVTB[p{i}]"
        fc.append(chain)
        labels.append(f"p{i}")
    cur, acc = labels[0], pieces[0]["len"]
    for i in range(1, n):
        off = acc - X
        fc.append(f"[{cur}][{labels[i]}]xfade=transition=fade:duration={X}:offset={off:.3f}[x{i}]")
        cur = f"x{i}"
        acc = off + pieces[i]["len"]
    vtotal = acc
    fc.append(f"[{cur}]fade=t=out:st={vtotal - 0.9:.3f}:d=0.9[base]")
    cur = "base"

    # плашки: плавное появление, лёгкий подъём снизу
    for k, (png, st, en) in enumerate(timed):
        d = max(0.8, en - st)
        idx = add_input("-loop", "1", "-framerate", str(FPS), "-t", f"{d:.3f}", "-i", png)
        fin = "" if st < 0.05 else "fade=t=in:st=0:d=0.45:alpha=1,"     # заставка — сразу, без появления
        ypos = "0" if st < 0.05 else f"'18*pow(max(0\\,1-(t-{st:.3f})/0.5)\\,2)'"
        fc.append(f"[{idx}:v]format=rgba,{fin}"
                  f"fade=t=out:st={d - 0.45:.3f}:d=0.45:alpha=1,setpts=PTS+{st:.3f}/TB[c{k}]")
        fc.append(f"[{cur}][c{k}]overlay=x=0:y={ypos}:"
                  f"eof_action=pass:enable='between(t,{st:.3f},{st + d:.3f})'[o{k}]")
        cur = f"o{k}"

    want_final = only != "preview"
    want_prev = only != "final"
    if want_final and want_prev:
        fc.append(f"[{cur}]split=2[vfin][vp0]")
    elif want_final:
        fc.append(f"[{cur}]null[vfin]")
    else:
        fc.append(f"[{cur}]null[vp0]")
    if want_prev:
        idx = add_input("-loop", "1", "-framerate", str(FPS), "-t", f"{vtotal:.3f}", "-i",
                        os.path.join(work, "wm.png"))
        fc.append(f"[vp0][{idx}:v]overlay=0:0:eof_action=pass,scale=540:960[vprev]")

    # звук: голос (каждую фразу приводим к одной громкости — голоса разных озвучек звучат по-разному)
    vo = []
    for i, s in enumerate([s for b in blocks for s in b["segs"]]):
        idx = add_input("-i", s["audio"])
        ms = int(s["start"] * 1000)
        gain = VOICE_DB - mean_db(s["audio"])
        fc.append(f"[{idx}:a]aresample=44100,aformat=channel_layouts=stereo,volume={gain:.2f}dB,"
                  f"adelay={ms}|{ms}[v{i}]")
        vo.append(f"[v{i}]")
    fc.append(f"{''.join(vo)}amix=inputs={len(vo)}:normalize=0:dropout_transition=0,"
              "highpass=f=70,acompressor=threshold=0.3:ratio=2.5:attack=15:release=180:makeup=1.15,"
              "aecho=1.0:0.92:55|95:0.09|0.05,asplit=2[voice][key]")
    # музыка: под голосом приглушается сама (sidechain), в паузах и в финале поднимается
    midx = add_input("-stream_loop", "-1", "-i", os.path.join(A, "audio", "music_bed.mp3"))
    fc.append(f"[{midx}:a]atrim=0:{vtotal:.3f},aresample=44100,aformat=channel_layouts=stereo,"
              f"volume={MUSIC_DB}dB,afade=t=in:st=0:d=0.3[m0]")
    fc.append("[m0][key]sidechaincompress=threshold=0.035:ratio=4:attack=80:release=1100:makeup=1[m1]")
    fc.append(f"[m1]afade=t=out:st={vtotal - 2.4:.3f}:d=2.4[music]")
    # эффекты: бубенцы в начале, волшебный перезвон на книге и в финале
    sfx, mix = [("sfx_bells.mp3", 0.1, 5.0)], ["[voice]", "[music]"]
    for b in blocks:
        if b["scene"] == "book":
            sfx.append(("sfx_chime.mp3", b["start"] + 0.5, 1.5))
        if b["scene"] == "elka":
            sfx.append(("sfx_chime.mp3", b["start"] + 0.1, 0.0))
    for j, (fn, at, db) in enumerate(sfx):
        idx = add_input("-i", os.path.join(A, "audio", fn))
        ms = int(at * 1000)
        fc.append(f"[{idx}:a]aresample=44100,aformat=channel_layouts=stereo,volume={db}dB,"
                  f"adelay={ms}|{ms}[f{j}]")
        mix.append(f"[f{j}]")
    fc.append(f"{''.join(mix)}amix=inputs={len(mix)}:normalize=0:dropout_transition=0,"
              f"atrim=0:{vtotal:.3f},volume={MASTER_DB}dB,alimiter=limit=0.94:level=disabled[amix]")
    if want_final and want_prev:
        fc.append("[amix]asplit=2[afin][aprev]")
    else:
        fc.append(f"[amix]anull[{'afin' if want_final else 'aprev'}]")

    graph = os.path.join(work, "graph.txt")
    with open(graph, "w", encoding="utf8") as f:
        f.write(";\n".join(fc))

    nice = re.sub(r"[^0-9A-Za-zА-Яа-яЁё]+", "-",
                  str(order.get("name") or order.get("title") or "поздравление")).strip("-")
    outs, cmd = {}, ["ffmpeg", "-y", "-v", "error", "-stats"] + inputs + ["-filter_complex_script", graph]
    if want_final:
        outs["final"] = os.path.join(out_dir, f"Дед-Мороз_{nice}.mp4")
        cmd += ["-map", "[vfin]", "-map", "[afin]", "-c:v", "libx264", "-preset", "medium", "-crf", "24",
                "-maxrate", "1800k", "-bufsize", "3600k", "-profile:v", "high", "-pix_fmt", "yuv420p",
                "-r", str(FPS), "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-movflags", "+faststart",
                "-t", f"{vtotal:.3f}", outs["final"]]
    if want_prev:
        outs["preview"] = os.path.join(out_dir, f"ОБРАЗЕЦ_Дед-Мороз_{nice}.mp4")
        cmd += ["-map", "[vprev]", "-map", "[aprev]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "27",
                "-maxrate", "1100k", "-bufsize", "2200k", "-pix_fmt", "yuv420p", "-r", str(FPS),
                "-c:a", "aac", "-b:a", "96k", "-ar", "44100", "-movflags", "+faststart",
                "-t", f"{vtotal:.3f}", outs["preview"]]
    t0 = time.time()
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(r.stderr[-4000:])
        raise SystemExit("ffmpeg не собрал ролик (граф сохранён в " + graph + ")")
    if not keep:
        for fn in os.listdir(work):
            os.remove(os.path.join(work, fn))
        os.rmdir(work)
    return {"outs": outs, "total": vtotal, "chars": chars, "render_s": time.time() - t0,
            "segs": segs, "blocks": blocks}


def main():
    ap = argparse.ArgumentParser(description="Видеопоздравление от Деда Мороза по анкете")
    ap.add_argument("order", nargs="?", help="JSON-файл анкеты (см. studio/orders/_пример.json)")
    ap.add_argument("--name"), ap.add_argument("--gender", default=None), ap.add_argument("--age", type=int)
    ap.add_argument("--fact", action="append", default=[]), ap.add_argument("--advice")
    ap.add_argument("--gift"), ap.add_argument("--from", dest="frm"), ap.add_argument("--city")
    ap.add_argument("--photo"), ap.add_argument("--style", choices=["kid", "adult", "group"])
    ap.add_argument("--tts", default="eleven", choices=["eleven", "eleven_turbo", "yandex"],
                    help="озвучка: eleven (лучший голос), eleven_turbo (вдвое дешевле), yandex (запасная)")
    ap.add_argument("--only", choices=["preview", "final"], help="собрать только превью или только финал")
    ap.add_argument("--brand", help="мелкая подпись в конце ролика, напр. «Заказать: t.me/ваш_ник»")
    ap.add_argument("--out", help="папка для результата")
    ap.add_argument("--text", action="store_true", help="только показать текст, ничего не тратить")
    ap.add_argument("--keep", action="store_true", help="не удалять рабочие файлы")
    a = ap.parse_args()

    order = {}
    if a.order:
        with open(a.order, encoding="utf8") as f:
            order = json.load(f)
        if order.get("photo") and not os.path.isabs(order["photo"]):
            order["photo"] = os.path.join(os.path.dirname(os.path.abspath(a.order)), order["photo"])
    for k, v in (("name", a.name), ("gender", a.gender), ("age", a.age), ("advice", a.advice),
                 ("gift", a.gift), ("from", a.frm), ("city", a.city), ("photo", a.photo), ("style", a.style)):
        if v is not None:
            order[k] = v
    if a.fact:
        order["facts"] = a.fact
    if not order.get("name") and not order.get("script") and order.get("style") != "group":
        ap.error("нужна анкета (JSON) или хотя бы --name")

    if a.text:
        segs = scriptlib.build(order)
        txt = scriptlib.plain_text(segs)
        print(txt)
        print(f"\n— {len(txt)} знаков, примерно {len(txt) / 9.6 + 12:.0f} секунд ролика")
        return

    slug = slugify(order.get("order_id") or order.get("name") or order.get("title") or "order")
    out_dir = a.out or os.path.join(HERE, "out", f"{time.strftime('%m%d-%H%M')}-{slug}")
    res = build(order, out_dir, provider=a.tts, brand=a.brand, only=a.only, keep=a.keep)
    print(f"Готово за {res['render_s']:.0f} с. Длительность {res['total']:.0f} с, озвучено {res['chars']} знаков.")
    for k, p in res["outs"].items():
        print(f"  {k}: {p}  ({os.path.getsize(p) / 1e6:.1f} МБ)")
    print(f"  текст: {os.path.join(out_dir, 'script.txt')}")


if __name__ == "__main__":
    main()

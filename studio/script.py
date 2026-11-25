"""Текст поздравления от Деда Мороза по анкете.

Анкета (order) — словарь:
  name     — как обращаться к ребёнку («Миша», «Сашенька»)            [обязательно]
  gender   — "m" или "f"                                              [по умолчанию "m"]
  age      — возраст числом (для взрослых не указывайте)
  facts    — до 4 фраз, продолжающих «Я знаю, что ты …»
             («научился кататься на велосипеде», «помогаешь маме»)
  advice   — наказ, продолжает «вот тебе мой наказ: …» («вовремя ложись спать»)
  gift     — заветное желание в именительном падеже («большой конструктор»).
             Указывайте, только если подарок действительно будет под ёлкой!
  from     — кто любит и передаёт привет («мама Оля и папа Дима»)
  city     — город («Казань»)
  style    — "kid" (по умолчанию), "adult" или "group" (одно видео на группу/класс — см. _build_group)
  photo    — путь к фото (покажем в волшебной книге)
  script   — готовый свой сценарий: список {"scene", "text", "card"} — тогда шаблон не используется
"""

SCENES = ("terem", "ded", "book", "gifts", "troika", "elka")

_ONES = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять", "десять",
         "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать",
         "семнадцать", "восемнадцать", "девятнадцать"]
_TENS = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят",
         "восемьдесят", "девяносто"]


def years_word(n):
    n = abs(int(n))
    if 11 <= n % 100 <= 14:
        return "лет"
    return {1: "год", 2: "года", 3: "года", 4: "года"}.get(n % 10, "лет")


def age_words(n):
    """6 -> «шесть лет», 21 -> «двадцать один год»."""
    n = int(n)
    if n <= 0 or n > 99:
        return f"{n} {years_word(n)}"
    num = _ONES[n] if n < 20 else (_TENS[n // 10] + (" " + _ONES[n % 10] if n % 10 else ""))
    return f"{num} {years_word(n)}"


def age_label(n):
    return f"{int(n)} {years_word(n)}"


def _cap(s):
    s = s.strip()
    return s[:1].upper() + s[1:] if s else s


def _clean(s):
    return " ".join(str(s).split()).strip(" .!?,;:")


def build(order):
    """Возвращает список сегментов: {key, scene, text, card?}."""
    if order.get("script"):
        segs = []
        for i, s in enumerate(order["script"]):
            if s.get("scene") not in SCENES:
                raise ValueError(f"script[{i}]: scene должен быть одним из {SCENES}")
            segs.append({"key": s.get("key", f"s{i}"), "scene": s["scene"], "text": s["text"].strip(),
                         "card": s.get("card")})
        return segs

    if order.get("style") == "group":
        return _build_group(order)

    name = _clean(order["name"])
    say = _clean(order.get("name_tts") or name)       # как произносить (можно с подсказкой ударения)
    f = str(order.get("gender", "m")).lower().startswith(("f", "ж", "д"))
    g = lambda m, fem: fem if f else m                # noqa: E731
    style = order.get("style", "kid")
    age = order.get("age")
    facts = [_clean(x) for x in (order.get("facts") or []) if _clean(x)][:4]
    advice = _clean(order.get("advice") or "")
    gift = _clean(order.get("gift") or "")
    frm = _clean(order.get("from") or "")
    city = _clean(order.get("city") or "")
    photo = order.get("photo")
    adult = style == "adult"

    segs = []

    # 1. Заставка: терем
    segs.append({"key": "intro", "scene": "terem",
                 "text": f"Хо-хо-хо! {say}! Тебе письмо от Дедушки Мороза!",
                 "card": {"type": "title", "name": name, "line": "тебе видеописьмо"}})

    # 2. Приветствие
    if adult:
        hello = (f"Здравствуй, {say}! Да-да, это я, Дедушка Мороз. Думаешь, я поздравляю только малышей? "
                 "Как бы не так! Взрослые ждут чудес ничуть не меньше — просто не признаются.")
    else:
        hello = (f"Здравствуй, {say}! Это я, Дедушка Мороз. Пишу тебе из своего терема в Великом Устюге. "
                 "За окном метель метёт, в печке дрова трещат, а я сижу и думаю о тебе.")
    if city:
        hello += f" Долетела до меня весточка из города {city}."
    segs.append({"key": "hello", "scene": "ded", "text": hello})

    # 3. Волшебная книга
    if adult or not age:
        book = ("Открыл я свою волшебную книгу, а в ней про тебя — целая страница, и вся золотыми буквами! "
                + ("" if adult else f"Как же ты {g('вырос', 'выросла')} за этот год, {say}!"))
        sub = None
    else:
        book = ("Открыл я свою волшебную книгу, а в ней про тебя — целая страница! "
                f"{say}, тебе ведь уже {age_words(age)}. Как же ты {g('вырос', 'выросла')} за этот год!")
        sub = age_label(age)
    segs.append({"key": "book", "scene": "book", "text": book.strip(),
                 "card": {"type": "name", "name": name, "sub": sub, "photo": photo}})

    # 4. Добрые дела
    if facts:
        lead = ["Я знаю, что ты", "Знаю, что ты", "А ещё ты", "И даже"]
        if len(facts) == 2:
            lead = ["Я знаю, что ты", "А ещё ты"]
        parts = [f"{lead[i]} {x}." for i, x in enumerate(facts)]
        tail = "Вот это да! Я очень тобой горжусь."
        text = " ".join(parts) + " " + tail
    elif adult:
        parts = []
        text = (f"Я знаю, что весь этот год ты {g('трудился', 'трудилась')} не покладая рук, "
                f"{g('заботился', 'заботилась')} о близких и {g('находил', 'находила')} силы улыбаться "
                "даже в самые хмурые дни. Это дорогого стоит!")
    else:
        parts = []
        text = (f"Я знаю, что в этом году ты {g('старался', 'старалась')} быть "
                f"{g('добрым и смелым', 'доброй и смелой')}, {g('помогал', 'помогала')} близким "
                f"и {g('узнал', 'узнала')} много нового. Я очень тобой горжусь!")
    seg = {"key": "facts", "scene": "ded", "text": text}
    if facts:
        seg["card"] = {"type": "facts", "items": [_cap(x) for x in facts],
                       "title": "Дед Мороз всё знает"}
        seg["reveal"] = parts            # куски текста — чтобы строки появлялись по мере рассказа
    segs.append(seg)

    # 5. Наказ
    if advice:
        adv = f"И вот тебе мой наказ: {advice}. Договорились? Вот и славно! И никогда не бойся мечтать."
    elif adult:
        adv = "Мой тебе наказ на новый год: побольше отдыхай, почаще смейся и не откладывай мечты на потом."
    else:
        adv = (f"Оставайся {g('таким же добрым и любознательным', 'такой же доброй и любознательной')}. "
               "Слушайся старших, береги тех, кто тебя любит, и никогда не бойся мечтать.")
    segs.append({"key": "advice", "scene": "ded", "text": adv})

    # 6. Подарки
    if gift:
        gtext = ("Мои помощники уже собирают мешок с подарками. И твоё заветное желание я знаю: "
                 f"{gift}. Загляни под ёлку в новогоднюю ночь — вдруг там что-то появится?")
        gcard = {"type": "gift", "text": _cap(gift)}
    elif adult:
        gtext = ("Мешок с подарками уже собран. И для тебя там припасено самое ценное: "
                 "здоровье, удача и немножко волшебства.")
        gcard = None
    else:
        gtext = ("Мои помощники уже собирают мешок с подарками. Есть там кое-что и для тебя. "
                 "Загляни под ёлку в новогоднюю ночь!")
        gcard = None
    segs.append({"key": "gift", "scene": "gifts", "text": gtext, "card": gcard})

    # 7. В дорогу
    segs.append({"key": "road", "scene": "troika",
                 "text": "Ну а мне пора в дорогу. Тройка запряжена, сани полны подарков — впереди долгий путь!"})

    # 8. Финал
    fin = f"С Новым годом, {say}! Пусть сбудется всё, о чём ты мечтаешь."
    if frm:
        fin += f" И помни: тебя очень любят — {frm}."
    fin += " До встречи под ёлкой! Твой Дедушка Мороз."
    segs.append({"key": "finale", "scene": "elka", "text": fin,
                 "card": {"type": "finale", "name": name}})
    return segs


def _join_names(names):
    names = [n for n in names if n]
    if len(names) <= 1:
        return "".join(names)
    return ", ".join(names[:-1]) + " и " + names[-1]


def _build_group(order):
    """Одно поздравление на всех: группа детсада, класс, кружок.

    Поля: group — как назвать коллектив в именительном падеже («группа „Солнышко“», «второй „Б“ класс»),
          title — крупное слово на заставке (по умолчанию «Ребята»), names — список имён,
          facts — что продолжает «Я знаю, что вы …», advice — «вот вам мой наказ: …», from — кто любит.
    """
    group = _clean(order.get("group") or "ваша дружная компания")
    title = _clean(order.get("title") or "Ребята")
    names = [_clean(n) for n in (order.get("names") or []) if _clean(n)]
    facts = [_clean(x) for x in (order.get("facts") or []) if _clean(x)][:4]
    advice = _clean(order.get("advice") or "")
    frm = _clean(order.get("from") or "")
    segs = [{"key": "intro", "scene": "terem",
             "text": "Хо-хо-хо! Ребята! Вам письмо от Дедушки Мороза!",
             "card": {"type": "title", "name": title, "line": "вам видеописьмо"}},
            {"key": "hello", "scene": "ded",
             "text": ("Здравствуйте, мои дорогие! Это я, Дедушка Мороз. Пишу вам из своего терема в Великом Устюге. "
                      f"Долетела до меня весточка, что {group} очень ждёт Новый год.")}]
    if names:
        half = names if len(names) <= 12 else names[:(len(names) + 1) // 2]
        rest = [] if len(names) <= 12 else names[len(half):]
        segs.append({"key": "book", "scene": "book",
                     "text": ("Открыл я свою волшебную книгу, а там — вся ваша дружная компания! Читаю по порядку. "
                              + _join_names(half) + "."),
                     "card": {"type": "names", "items": half, "title": "В волшебной книге записаны"}})
        if rest:
            segs.append({"key": "book2", "scene": "ded",
                         "text": "И это ещё не все! " + _join_names(rest) + ". Никого не забыл!",
                         "card": {"type": "names", "items": rest, "title": "И ещё", "low": True}})
    else:
        segs.append({"key": "book", "scene": "book",
                     "text": "Открыл я свою волшебную книгу, а там — вся ваша дружная компания, все до единого!"})
    if facts:
        lead = ["Я знаю, что вы", "Знаю, что вы", "А ещё вы", "И даже"]
        if len(facts) == 2:
            lead = ["Я знаю, что вы", "А ещё вы"]
        parts = [f"{lead[i]} {x}." for i, x in enumerate(facts)]
        segs.append({"key": "facts", "scene": "ded", "text": " ".join(parts) + " Вот это да! Я вами очень горжусь.",
                     "card": {"type": "facts", "items": [_cap(x) for x in facts], "title": "Дед Мороз всё знает"},
                     "reveal": parts})
    else:
        segs.append({"key": "facts", "scene": "ded",
                     "text": ("Я знаю, что весь этот год вы дружили, помогали друг другу и узнали много нового. "
                              "Я вами очень горжусь!")})
    segs.append({"key": "advice", "scene": "ded",
                 "text": (f"И вот вам мой наказ: {advice}. Договорились? Вот и славно!" if advice else
                          "И вот вам мой наказ: не ссорьтесь, помогайте друг другу и слушайтесь старших. "
                          "Договорились? Вот и славно!")})
    segs.append({"key": "gift", "scene": "gifts",
                 "text": ("Мои помощники уже собирают мешок с подарками — хватит каждому из вас! "
                          "Загляните под ёлку в новогоднюю ночь.")})
    segs.append({"key": "road", "scene": "troika",
                 "text": "Ну а мне пора в дорогу. Тройка запряжена, сани полны подарков — впереди долгий путь!"})
    fin = "С Новым годом, ребята! Пусть сбудутся все ваши мечты."
    if frm:
        fin += f" И помните: вас очень любят — {frm}."
    fin += " До встречи под ёлкой! Ваш Дедушка Мороз."
    segs.append({"key": "finale", "scene": "elka", "text": fin,
                 "card": {"type": "finale", "name": "ребята", "sub": "ваш Дедушка Мороз"}})
    return segs


def plain_text(segs):
    return "\n\n".join(s["text"] for s in segs)

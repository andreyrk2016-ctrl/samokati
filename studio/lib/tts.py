"""Озвучка: ElevenLabs (основной голос Деда Мороза) и Yandex SpeechKit (запасной, дешёвый).
В облачной сессии Claude ключ ElevenLabs подставляет прокси; Yandex — из переменной
YANDEX_SPEECHKIT_API_KEY."""
import json, os, subprocess, urllib.parse, urllib.request, urllib.error

ELEVEN_VOICE = "0vJ96DzHePfGJitmI6UX"      # «Ivan - New Year Storyteller» из библиотеки ElevenLabs
ELEVEN_MODEL = "eleven_v4"


def _post(url, data, headers, timeout=180):
    req = urllib.request.Request(url, data=data, method="POST")
    for k, v in headers.items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"TTS HTTP {e.code}: {e.read().decode(errors='replace')[:500]}")


def eleven(text, dest, voice=ELEVEN_VOICE, model=ELEVEN_MODEL, settings=None, seed=None):
    body = {"text": text, "model_id": model, "language_code": "ru"}
    if settings:
        body["voice_settings"] = settings
    if seed is not None:
        body["seed"] = seed
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_192"
    audio = _post(url, json.dumps(body).encode(),
                  {"xi-api-key": os.environ.get("ELEVENLABS_API_KEY", "dummy"),
                   "Content-Type": "application/json"})
    with open(dest, "wb") as f:
        f.write(audio)
    return dest


def yandex(text, dest, voice="zahar", emotion="good", speed=0.9):
    """Yandex SpeechKit v1. В тексте можно ставить «+» перед ударной гласной: М+иша."""
    key = os.environ.get("YANDEX_SPEECHKIT_API_KEY")
    if not key:
        raise RuntimeError("нет YANDEX_SPEECHKIT_API_KEY")
    form = {"text": text, "lang": "ru-RU", "voice": voice, "speed": str(speed),
            "format": "mp3"}
    if emotion:
        form["emotion"] = emotion
    audio = _post("https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize",
                  urllib.parse.urlencode(form).encode(),
                  {"Authorization": "Api-Key " + key})
    with open(dest, "wb") as f:
        f.write(audio)
    return dest


def duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "default=nw=1:nk=1", path], capture_output=True, text=True)
    return float(out.stdout.strip())


def transcribe(path):
    """Проверка озвучки распознаванием (ElevenLabs Scribe) — возвращает текст."""
    boundary = "----studio" + os.urandom(8).hex()
    with open(path, "rb") as f:
        blob = f.read()
    parts = []
    for k, v in (("model_id", "scribe_v1"), ("language_code", "ru")):
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.mp3"\r\n'
                 f'Content-Type: audio/mpeg\r\n\r\n'.encode() + blob + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    raw = _post("https://api.elevenlabs.io/v1/speech-to-text", b"".join(parts),
                {"xi-api-key": os.environ.get("ELEVENLABS_API_KEY", "dummy"),
                 "Content-Type": f"multipart/form-data; boundary={boundary}"})
    return json.loads(raw.decode()).get("text", "")

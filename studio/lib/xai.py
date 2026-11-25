"""Мини-клиент xAI (картинки и видео). Ключ подставляет прокси облачной сессии;
вне её задайте переменную окружения XAI_API_KEY."""
import base64, json, os, time, urllib.request, urllib.error

BASE = "https://api.x.ai/v1"


def _req(method, path, body=None, timeout=300):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Authorization", "Bearer " + os.environ.get("XAI_API_KEY", "dummy"))
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"xAI {e.code}: {e.read().decode()[:600]}")


def _download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "studio/1.0"})
    with urllib.request.urlopen(req, timeout=300) as r, open(dest, "wb") as f:
        f.write(r.read())
    return dest


def image(prompt, dest, aspect_ratio="9:16", model="grok-imagine-image-2.0",
          resolution="1k", quality="medium", n=1):
    """Генерирует n картинок, сохраняет dest (при n>1: dest_1, dest_2...)."""
    body = {"model": model, "prompt": prompt, "n": n, "aspect_ratio": aspect_ratio,
            "response_format": "b64_json"}
    if model.endswith("2.0"):
        body["resolution"] = resolution
        body["quality"] = quality
    r = _req("POST", "/images/generations", body)
    out = []
    for i, item in enumerate(r["data"]):
        p = dest if n == 1 else dest.replace(".", f"_{i+1}.", 1) if dest.count(".") == 1 else f"{dest}_{i+1}"
        with open(p, "wb") as f:
            f.write(base64.b64decode(item["b64_json"]))
        out.append(p)
    return out


def edit(prompt, src, dest, model="grok-imagine-image-2.0"):
    """Правка картинки по описанию (src — локальный файл)."""
    with open(src, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    mime = "image/png" if src.lower().endswith(".png") else "image/jpeg"
    body = {"model": model, "prompt": prompt, "response_format": "b64_json",
            "image": {"url": f"data:{mime};base64,{b64}", "type": "image_url"}}
    r = _req("POST", "/images/edits", body)
    with open(dest, "wb") as f:
        f.write(base64.b64decode(r["data"][0]["b64_json"]))
    return dest


def video_start(prompt, image_path=None, duration=10, model="grok-imagine-video-1.5-lite",
                resolution="720p", aspect_ratio="9:16", audio=False):
    body = {"model": model, "prompt": prompt, "duration": duration,
            "resolution": resolution, "generate_audio": audio}
    if image_path:
        with open(image_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        mime = "image/png" if image_path.lower().endswith(".png") else "image/jpeg"
        body["image"] = {"url": f"data:{mime};base64,{b64}"}
    else:
        body["aspect_ratio"] = aspect_ratio
    return _req("POST", "/videos/generations", body)["request_id"]


def video_wait(request_id, dest, poll=6, timeout=1200):
    t0 = time.time()
    while time.time() - t0 < timeout:
        r = _req("GET", f"/videos/{request_id}")
        st = r.get("status")
        if st == "done":
            _download(r["video"]["url"], dest)
            return dest
        if st in ("failed", "expired"):
            raise RuntimeError(f"video {request_id}: {json.dumps(r)[:500]}")
        time.sleep(poll)
    raise TimeoutError(request_id)

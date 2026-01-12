import os
import time
import uuid
import tempfile
import subprocess
import traceback
import requests
import base64
import io

import win32print
from PIL import Image, ImageDraw, ImageFont


# =========================
# Config (env)
# =========================
CLOUD_BASE = os.getenv("CLOUD_BASE", "").rstrip("/")
PRINT_AGENT_TOKEN = os.getenv("PRINT_AGENT_TOKEN", "")
PRINTER_NAME = os.getenv("PRINTER_NAME", "")

POLL_INTERVAL_SEC = float(os.getenv("POLL_INTERVAL_SEC", "2.0"))
HTTP_TIMEOUT_SEC = float(os.getenv("HTTP_TIMEOUT_SEC", "12.0"))

# RAW
RAW_DEFAULT_ENCODING = os.getenv("RAW_DEFAULT_ENCODING", "cp950")

# image_text render
FONT_SIZE = int(os.getenv("FONT_SIZE", "28"))
MARGIN_LEFT = int(os.getenv("MARGIN_LEFT", "24"))
MARGIN_TOP = int(os.getenv("MARGIN_TOP", "24"))
LINE_HEIGHT_MULT = float(os.getenv("LINE_HEIGHT_MULT", "1.35"))
MIN_WIDTH = int(os.getenv("MIN_WIDTH", "900"))

# rotation / mirror
ROTATE_DEG = int(os.getenv("ROTATE_DEG", "0"))   # 0 / 90 / 180 / 270 (PIL is CCW)
MIRROR_X = os.getenv("MIRROR_X", "0") == "1"     # left-right
MIRROR_Y = os.getenv("MIRROR_Y", "0") == "1"     # top-bottom

# fonts
FONT_CANDIDATES = [
    os.getenv("FONT_PATH", "").strip(),
    r"C:\Windows\Fonts\mingliu.ttc",
    r"C:\Windows\Fonts\msjh.ttc",
    r"C:\Windows\Fonts\kaiu.ttf",
]
FONT_CANDIDATES = [p for p in FONT_CANDIDATES if p]

# Windows native print
MSPAINT_PATH = r"C:\Windows\System32\mspaint.exe"
PRINT_TIMEOUT_SEC = 45


def log(msg: str):
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def require_env():
    if not CLOUD_BASE or not PRINT_AGENT_TOKEN:
        raise RuntimeError("Missing CLOUD_BASE or PRINT_AGENT_TOKEN")


# =========================
# HTTP
# =========================
def get_next_job():
    r = requests.get(
        f"{CLOUD_BASE}/print-jobs/next",
        headers={"Authorization": f"Bearer {PRINT_AGENT_TOKEN}"},
        timeout=HTTP_TIMEOUT_SEC,
    )
    if r.status_code == 204:
        return None
    r.raise_for_status()
    return r.json()


def ack_job(job_id: str, ok: bool, message: str = ""):
    try:
        requests.post(
            f"{CLOUD_BASE}/print-jobs/{job_id}/ack",
            headers={"Authorization": f"Bearer {PRINT_AGENT_TOKEN}"},
            json={"ok": ok, "message": message},
            timeout=HTTP_TIMEOUT_SEC,
        )
    except Exception as e:
        log(f"ACK failed: {e}")


# =========================
# RAW printing
# =========================
def print_raw(printer_name: str, data: bytes, doc_name: str):
    h = win32print.OpenPrinter(printer_name)
    try:
        win32print.StartDocPrinter(h, 1, (doc_name, None, "RAW"))
        win32print.StartPagePrinter(h)
        win32print.WritePrinter(h, data)
        win32print.EndPagePrinter(h)
        win32print.EndDocPrinter(h)
    finally:
        win32print.ClosePrinter(h)


# =========================
# image_text rendering
# =========================
def pick_font(size: int):
    for fp in FONT_CANDIDATES:
        if fp and os.path.exists(fp):
            return ImageFont.truetype(fp, size=size)
    raise RuntimeError("No usable Chinese font found")


def render_text_to_image(text: str):
    font = pick_font(FONT_SIZE)
    lines = text.splitlines() or [""]

    dummy = Image.new("RGB", (10, 10))
    d = ImageDraw.Draw(dummy)

    max_w = max(d.textlength(line, font=font) for line in lines)
    line_h = int(FONT_SIZE * LINE_HEIGHT_MULT)

    width = max(MIN_WIDTH, int(max_w) + MARGIN_LEFT * 2)
    height = line_h * len(lines) + MARGIN_TOP * 2

    img = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(img)

    y = MARGIN_TOP
    for line in lines:
        draw.text((MARGIN_LEFT, y), line, font=font, fill="black")
        y += line_h

    # ===== direction fix =====
    if ROTATE_DEG in (90, 180, 270):
        img = img.rotate(ROTATE_DEG, expand=True)
    if MIRROR_X:
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
    if MIRROR_Y:
        img = img.transpose(Image.FLIP_TOP_BOTTOM)

    return img


def is_base64_image(text: str):
    """檢查 text 是否為 base64 編碼的圖片數據（PNG 或 JPEG）"""
    if not text or len(text) < 100:
        return False
    try:
        # 嘗試解碼 base64（只解碼前1000字符來檢查文件頭）
        decoded = base64.b64decode(text[:1000], validate=True)
        if len(decoded) >= 8:
            # PNG: 89 50 4E 47 0D 0A 1A 0A
            if decoded[:8] == b'\x89PNG\r\n\x1a\n':
                return True
            # JPEG: FF D8 FF
            if decoded[:3] == b'\xff\xd8\xff':
                return True
    except:
        pass
    return False


def print_image_via_windows(img: Image.Image, copies: int):
    tmp = os.path.join(tempfile.gettempdir(), f"print_{uuid.uuid4().hex}.png")
    img.save(tmp, "PNG")

    try:
        for _ in range(copies):
            p = subprocess.Popen([MSPAINT_PATH, "/p", tmp])
            p.wait(timeout=PRINT_TIMEOUT_SEC)
            time.sleep(0.5)
    finally:
        try:
            os.remove(tmp)
        except Exception:
            pass


# =========================
# Job handling
# =========================
def handle_job(job: dict):
    job_id = job["id"]
    kind = job.get("kind", "raw")
    copies = int(job.get("copies", 1))
    text = job.get("text", "")

    if kind == "raw":
        data = text.encode(RAW_DEFAULT_ENCODING, errors="replace")
        log(f"RAW job {job_id}")
        print_raw(PRINTER_NAME, data, f"RAW-{job_id}")

    elif kind == "image_text":
        # 檢查 text 是普通文本還是 base64 圖片
        if is_base64_image(text):
            # 這是 base64 編碼的圖片（來自 PDF 轉換）
            log(
                f"IMG job {job_id} (base64 image) rotate={ROTATE_DEG} "
                f"mirror_x={MIRROR_X} mirror_y={MIRROR_Y}"
            )
            try:
                # 解碼 base64 圖片
                image_bytes = base64.b64decode(text, validate=True)
                img = Image.open(io.BytesIO(image_bytes))
                
                # 應用旋轉和鏡像
                if ROTATE_DEG in (90, 180, 270):
                    img = img.rotate(ROTATE_DEG, expand=True)
                if MIRROR_X:
                    img = img.transpose(Image.FLIP_LEFT_RIGHT)
                if MIRROR_Y:
                    img = img.transpose(Image.FLIP_TOP_BOTTOM)
                
                print_image_via_windows(img, copies)
            except Exception as e:
                log(f"ERROR decoding base64 image: {e}")
                traceback.print_exc()
                raise
        else:
            # 這是普通文本（用於測試打印）
            log(
                f"IMG job {job_id} (text) rotate={ROTATE_DEG} "
                f"mirror_x={MIRROR_X} mirror_y={MIRROR_Y}"
            )
            img = render_text_to_image(text)
            print_image_via_windows(img, copies)

    else:
        raise ValueError(f"Unknown kind: {kind}")


# =========================
# Main
# =========================
def main():
    require_env()
    log("Agent started")

    while True:
        try:
            job = get_next_job()
            if not job:
                time.sleep(POLL_INTERVAL_SEC)
                continue

            try:
                handle_job(job)
                ack_job(job["id"], True, "printed")
            except Exception as e:
                log(f"ERROR job={job['id']}: {e}")
                traceback.print_exc()
                ack_job(job["id"], False, str(e))

        except KeyboardInterrupt:
            break
        except Exception as e:
            log(f"ERROR loop: {e}")
            traceback.print_exc()
            time.sleep(POLL_INTERVAL_SEC)


if __name__ == "__main__":
    main()

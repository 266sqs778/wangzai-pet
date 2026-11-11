# -*- coding: utf-8 -*-
"""
Local control server for the Wangzai desktop pet.

It serves the cloned homepage, keeps pet-config.json as the single source of
truth, and launches / talks to the transparent desktop-pet window.

    python server.py            # serve + open browser + launch pet
    python server.py --no-pet   # serve only (useful for debugging)

Everything stays on 127.0.0.1. No data leaves the machine.
"""
from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
import threading
import time
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import numpy as np
from PIL import Image
from build_assets import fit, remove_background, soft_badge

ROOT = Path(__file__).resolve().parent
PET_DIR = ROOT / "assets" / "pet"
CONFIG = ROOT / "pet-config.json"
RUNTIME = ROOT / "runtime.json"
PORT = 8765

DEFAULT_CONFIG = {
    "name": "望崽",
    "species": "cat",
    "size": 220,
    "speed": 2,
    "opacity": 1.0,
    "topmost": True,
    "auto": True,
    "visible": True,
    "action": "idle",
    "message": "",
    "x": None,
    "y": None,
    "seq": 1,
    "command": {"type": "idle", "message": ""},
    "lines": [
        "在呢，一直都在。",
        "今天也要好好工作呀～",
        "摸摸我就有精神啦！",
        "你在忙吗？我陪着你。",
        "伸个懒腰，继续加油！",
        "别忘了喝水哦。",
    ],
}

_lock = threading.Lock()
_pet_process = None


def read_config() -> dict:
    with _lock:
        try:
            data = json.loads(CONFIG.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            data = dict(DEFAULT_CONFIG)
        merged = dict(DEFAULT_CONFIG)
        merged.update(data)
        return merged


def write_config(patch: dict, command: dict | None = None) -> dict:
    with _lock:
        try:
            data = json.loads(CONFIG.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            data = dict(DEFAULT_CONFIG)
        merged = dict(DEFAULT_CONFIG)
        merged.update(data)
        merged.update(patch)
        merged["seq"] = int(merged.get("seq", 0)) + 1
        if command is not None:
            merged["command"] = command
            if command.get("type") == "action":
                merged["action"] = command.get("action", "idle")
        tmp = CONFIG.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(CONFIG)
        return merged


def is_running() -> bool:
    try:
        info = json.loads(RUNTIME.read_text(encoding="utf-8"))
        return time.time() - float(info.get("ts", 0)) < 1.5
    except (OSError, ValueError):
        return False


def python_for_pet() -> str:
    """Prefer pythonw.exe (no console window) of the interpreter running us."""
    exe = Path(sys.executable)
    candidate = exe.with_name("pythonw.exe")
    return str(candidate if candidate.exists() else exe)


def launch_pet() -> bool:
    global _pet_process
    if is_running():
        return True
    # The previous pet is gone (or stopped heartbeating). Clear its stale
    # heartbeat file so the new process does not think a sibling is running.
    if _pet_process is not None and _pet_process.poll() is None:
        try:
            _pet_process.terminate()
        except OSError:
            pass
    _pet_process = None
    RUNTIME.unlink(missing_ok=True)
    try:
        flags = 0
        if os.name == "nt":
            flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        _pet_process = subprocess.Popen(
            [python_for_pet(), str(ROOT / "desktop_pet.py")],
            cwd=str(ROOT), creationflags=flags,
        )
        return True
    except Exception as exc:  # noqa: BLE001
        print("launch pet failed:", exc)
        return False


def handle_upload(data_url: str, smart_matte: bool = False) -> str:
    """Turn an uploaded photo into a transparent sprite the pet can wear.

    Default: a round feathered portrait sticker (works with ANY background).
    Optional smart matting is only trustworthy on a plain, even background -
    if it eats into the subject we quietly fall back to the sticker."""
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    raw = base64.b64decode(data_url)
    PET_DIR.mkdir(parents=True, exist_ok=True)
    tmp = PET_DIR / ".upload.png"
    tmp.write_bytes(raw)

    sprite = None
    if smart_matte:
        try:
            candidate = fit(remove_background(tmp, target_h=280, tol=52))
            a = np.asarray(candidate.getchannel("A"))
            h, w = a.shape
            centre = a[h // 4:3 * h // 4, w // 4:3 * w // 4]
            transparent = (a < 8).mean()
            if 0.15 < transparent < 0.78 and (centre < 8).mean() < 0.22:
                sprite = candidate
        except Exception:  # noqa: BLE001
            sprite = None
    if sprite is None:
        sprite = soft_badge(tmp)

    sprite.save(PET_DIR / "my-pet.png")
    sprite.transpose(Image.Transpose.FLIP_LEFT_RIGHT).save(PET_DIR / "my-pet_left.png")
    tmp.unlink(missing_ok=True)
    return "my"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        if "/api/" in (self.path or ""):
            super().log_message(fmt, *args)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()

    def _json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.startswith("/api/state"):
            self._json({"ok": True, "running": is_running(), "config": read_config()})
            return
        if self.path.startswith("/api/health"):
            self._json({"ok": True})
            return
        super().do_GET()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0) or 0)
        try:
            body = json.loads(self.rfile.read(length) or b"{}")
        except ValueError:
            self._json({"ok": False, "error": "bad json"}, 400)
            return

        path = self.path.split("?")[0]
        if path == "/api/config":
            patch = {k: v for k, v in body.items()
                     if k in ("name", "species", "size", "speed", "opacity",
                              "topmost", "auto", "visible", "lines", "x", "y")}
            cfg = write_config(patch, {"type": "config", "message": ""})
            self._json({"ok": True, "config": cfg})

        elif path == "/api/command":
            cmd = {
                "type": body.get("type", "action"),
                "action": body.get("action", "idle"),
                "message": body.get("message", ""),
            }
            cfg = write_config({}, cmd)
            self._json({"ok": True, "config": cfg})

        elif path == "/api/launch":
            ok = launch_pet()
            self._json({"ok": ok, "running": is_running()})

        elif path == "/api/quit":
            write_config({}, {"type": "quit", "message": ""})
            self._json({"ok": True})

        elif path == "/api/upload":
            try:
                species = handle_upload(body.get("image", ""), bool(body.get("smart_matte")))
                cfg = write_config(
                    {"species": species, "visible": True},
                    {"type": "action", "action": "happy", "message": body.get("message", "你好呀，我来啦！")},
                )
                self._json({"ok": True, "species": species, "config": cfg})
            except Exception as exc:  # noqa: BLE001
                self._json({"ok": False, "error": str(exc)}, 500)

        else:
            self._json({"ok": False, "error": "unknown endpoint"}, 404)


def main() -> None:
    if not CONFIG.exists():
        CONFIG.write_text(json.dumps(DEFAULT_CONFIG, ensure_ascii=False, indent=2), encoding="utf-8")

    no_pet = "--no-pet" in sys.argv
    no_browser = "--no-browser" in sys.argv

    try:
        server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    except OSError:
        # Another console is already serving (e.g. started by the assistant).
        print(f"Console already running -> http://127.0.0.1:{PORT}")
        if not no_browser:
            webbrowser.open(f"http://127.0.0.1:{PORT}/")
        return
    print(f"Wangzai pet console -> http://127.0.0.1:{PORT}")
    threading.Thread(target=server.serve_forever, daemon=True).start()

    if not no_pet:
        threading.Timer(0.8, launch_pet).start()
    if not no_browser:
        threading.Timer(1.2, lambda: webbrowser.open(f"http://127.0.0.1:{PORT}/")).start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        server.shutdown()


if __name__ == "__main__":
    main()

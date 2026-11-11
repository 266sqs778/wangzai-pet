# -*- coding: utf-8 -*-
"""Compile the generic dengdeng-pet.exe and produce the downloadable EXE zip.

Requires PyInstaller (pip install pyinstaller) and Pillow. The resulting EXE is
generic: it reads pet-config.json and assets/pet/*.png from its own folder.

    python scripts/build_exe.py --out dist/dengdeng-pet-exe.zip
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SKILL_ROOT = HERE.parent
PET_DIR = SKILL_ROOT / "assets" / "pet"

DEFAULT_CONFIG = {
    "name": "灯灯", "species": "cat", "size": 220, "speed": 2,
    "opacity": 1.0, "topmost": True, "auto": True, "visible": True,
    "action": "idle", "seq": 1, "command": {"type": "idle", "message": ""},
    "lines": ["在呢，一直都在。", "今天也要好好工作呀～", "摸摸我就有精神啦！", "别忘了喝水哦。"],
}

README = """灯灯桌宠 · EXE 完整版
========================================

1. 解压整个压缩包到任意文件夹（不要直接在压缩软件里双击）。
2. 双击 dengdeng-pet.exe，桌宠出现在屏幕右下角。
3. 左键拖动、双击摸摸、滚轮缩放、右键菜单可换动作。
4. 用记事本改 pet-config.json 可换形象、改名字、大小、速度、台词；重启生效。
5. 想换成自家宠物：把透明 PNG 命名为 my-pet.png 放进 assets/pet/，
   并把 pet-config.json 里的 species 改成 "my"。

不需要 Python、不需要联网、不上传任何照片。
"""


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="dist/dengdeng-pet-exe.zip")
    ap.add_argument("--skip-compile", action="store_true", help="reuse an existing exe")
    args = ap.parse_args()

    build_dir = SKILL_ROOT / "build"
    dist_dir = SKILL_ROOT / "dist"
    exe = dist_dir / "dengdeng-pet.exe"

    if not args.skip_compile:
        cmd = [
            sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean",
            "--onefile", "--windowed", "--name", "dengdeng-pet",
            "--distpath", str(dist_dir), "--workpath", str(build_dir),
            "--specpath", str(SKILL_ROOT),
            "--exclude-module", "numpy", "--exclude-module", "matplotlib",
            "--hidden-import", "PIL._tkinter_finder", str(HERE / "bundle_pet.py"),
        ]
        print("Compiling:", " ".join(cmd))
        subprocess.check_call(cmd, cwd=str(SKILL_ROOT))

    if not exe.exists():
        raise SystemExit(f"EXE not found: {exe}")

    out = Path(args.out).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        z.writestr("pet-config.json", json.dumps(DEFAULT_CONFIG, ensure_ascii=False, indent=2))
        z.writestr("README.txt", "\ufeff" + README)
        z.write(exe, "dengdeng-pet.exe")
        for p in sorted(PET_DIR.glob("*.png")):
            if not p.name.startswith("."):
                z.write(p, "assets/pet/" + p.name)
    print(f"OK  {out}  ({out.stat().st_size / 1024 / 1024:.2f} MB)")


if __name__ == "__main__":
    main()

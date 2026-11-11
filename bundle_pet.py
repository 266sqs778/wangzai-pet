# -*- coding: utf-8 -*-
"""Frozen entry point for the distributable wangzai-pet.exe.

The EXE is generic: it reads pet-config.json and assets/pet/*.png from the
folder that contains the executable. That means one compiled binary can be
reused for any customised pet - just replace the config and the sprites.

Build:  python -m PyInstaller --onefile --windowed --clean dengdeng-pet.spec
"""
from __future__ import annotations

import os
import sys
from pathlib import Path


def resolve_home() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


def main() -> None:
    home = resolve_home()
    os.environ["DENGPET_HOME"] = str(home)
    from desktop_pet import main as pet_main
    pet_main()


if __name__ == "__main__":
    main()

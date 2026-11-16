"""Generate the missing action frames for 望崽宠乐园 desktop pets.

The cat/orange sprites ship with real stretch/groom frames, but the cartoon
animals (rabbit, bird, hamster, chinchilla) and the photoreal dog only had
idle/sleep. Previously the customiser clamped "stretch/groom" onto idle or
sleep, so pressing those buttons did nothing (or put the pet to bed).

This script derives three extra poses from each idle sprite with gentle,
deterministic image transforms:
  - walk    : a slight lean (as if mid-step)
  - stretch : vertical stretch, bottom anchored (a "big stretch" feel)
  - groom   : a side tilt (as if licking fur)

Transparent RGBA is preserved so the existing magenta-key export pipeline is
unchanged. The script is safe to re-run; it only writes the files below.

Usage:  python generate_action_frames.py
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
PET = ROOT / "web" / "assets" / "pet"

# Cartoon animals tolerate stronger transforms; the photoreal dog uses gentler
# values so it never looks like a badly stretched photo.
CARTOON = ("rabbit", "bird", "hamster", "chinchilla")


def centered_rotate(im: Image.Image, deg: float, scale: float = 1.0) -> Image.Image:
    """Rotate/scale about the canvas centre without clipping the subject."""
    w, h = im.size
    pad = int(max(w, h) * 0.18)
    pw, ph = w + 2 * pad, h + 2 * pad
    big = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
    big.alpha_composite(im, (pad, pad))
    out = big.rotate(deg, resample=Image.BICUBIC, expand=False, fillcolor=(0, 0, 0, 0))
    if abs(scale - 1.0) > 1e-6:
        out = out.resize((int(pw * scale), int(ph * scale)), Image.LANCZOS)
    cx, cy = out.width // 2, out.height // 2
    return out.crop((cx - w // 2, cy - h // 2, cx - w // 2 + w, cy - h // 2 + h))


def stretch(im: Image.Image, fy: float, fx: float) -> Image.Image:
    """Vertical stretch with the bottom edge pinned to the ground line."""
    w, h = im.size
    nw, nh = int(w * fx), int(h * fy)
    scaled = im.resize((nw, nh), Image.LANCZOS)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.alpha_composite(scaled, ((w - nw) // 2, h - nh))
    return out


def save(im: Image.Image, name: str) -> None:
    path = PET / f"{name}.png"
    im.save(path, "PNG", optimize=True)
    print("wrote", path.name)


def main() -> None:
    for name in CARTOON:
        idle = Image.open(PET / f"{name}_idle.png").convert("RGBA")
        save(stretch(idle, 1.16, 0.94), f"{name}_stretch")
        save(centered_rotate(idle, 11.0), f"{name}_groom")
        save(centered_rotate(idle, 4.0, 0.98), f"{name}_walk")

    # Photoreal golden retriever: keep transforms subtle to avoid a
    # "stretched photo" look. dog_walk already exists, so only add two poses.
    dog = Image.open(PET / "dog_idle.png").convert("RGBA")
    save(stretch(dog, 1.06, 0.985), "dog_stretch")
    save(centered_rotate(dog, 6.0, 1.0), "dog_groom")

    print("done")


if __name__ == "__main__":
    main()

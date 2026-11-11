# -*- coding: utf-8 -*-
"""
Build transparent desktop-pet sprites from the downloaded showcase photos.

Run:  python build_assets.py
It is safe to run again after you replace any photo inside assets/.
Only Pillow + numpy are needed (both preinstalled in this workspace).
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "assets"
OUT = ROOT / "assets" / "pet"
OUT.mkdir(parents=True, exist_ok=True)

CANVAS = 300  # every sprite fits into a 300x300 transparent canvas, bottom aligned


def remove_background(path: Path, target_h: int = 260, tol: float = 46) -> Image.Image:
    """Official showcase art already has an alpha channel - just use it.
    For a plain photo (e.g. a user's own pet picture), flood-fill matting removes
    only the background connected to the border, so light fur stays intact."""
    src = Image.open(path)
    if src.mode in ("RGBA", "LA") or "transparency" in src.info:
        rgba = src.convert("RGBA")
        arr = np.array(rgba)
        rgb, alpha = arr[:, :, :3], arr[:, :, 3]
        # Transparent pixels often carry black/garbage RGB. Warm them up so the
        # semi-transparent fur edge never gets a dark fringe on the desktop.
        rgb[alpha < 8] = (246, 238, 226)
        dark = (alpha < 200) & (rgb.mean(axis=2) < 70)
        rgb[dark] = (226, 206, 184)
        rgba = Image.fromarray(arr, "RGBA")
        w, h = rgba.size
        return rgba.resize((max(1, int(w * target_h / h)), target_h), Image.LANCZOS)

    im = src.convert("RGB")
    w, h = im.size
    scale = target_h / h
    im = im.resize((max(1, int(w * scale)), target_h), Image.LANCZOS)
    arr = np.asarray(im).astype(np.int16)
    H, W = arr.shape[:2]

    corners = np.concatenate([
        arr[:12, :12].reshape(-1, 3), arr[:12, -12:].reshape(-1, 3),
        arr[-12:, :12].reshape(-1, 3), arr[-12:, -12:].reshape(-1, 3),
    ])
    bg = np.median(corners, axis=0)
    dist = np.sqrt(((arr - bg) ** 2).sum(axis=2))
    # A loose global guard stops the walk from eating dark fur.
    global_ok = (dist < max(tol * 2.0, 105)).tolist()

    # Adaptive flood fill: each step only accepts a neighbour whose colour is
    # close to the CURRENT pixel, so gentle background gradients are followed
    # while the sharp colour jump at the fur edge stops the walk.
    from collections import deque
    pixels = arr.tolist()
    seen = [[False] * W for _ in range(H)]
    queue = deque()
    for x in range(W):
        queue.append((0, x, None)); queue.append((H - 1, x, None))
    for y in range(H):
        queue.append((y, 0, None)); queue.append((y, W - 1, None))
    local = 46  # Manhattan RGB distance
    while queue:
        y, x, ref = queue.popleft()
        if seen[y][x] or not global_ok[y][x]:
            continue
        c = pixels[y][x]
        if ref is not None and (abs(c[0] - ref[0]) + abs(c[1] - ref[1]) + abs(c[2] - ref[2])) > local:
            continue
        seen[y][x] = True
        if y > 0 and not seen[y - 1][x]: queue.append((y - 1, x, c))
        if y < H - 1 and not seen[y + 1][x]: queue.append((y + 1, x, c))
        if x > 0 and not seen[y][x - 1]: queue.append((y, x - 1, c))
        if x < W - 1 and not seen[y][x + 1]: queue.append((y, x + 1, c))

    region = np.asarray(seen, dtype=bool)
    alpha = np.where(region, 0, 255).astype(np.uint8)
    # A soft edge keeps the fur from looking cut out with scissors.
    soft = Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(0.7))
    rgba = im.convert("RGBA")
    rgba.putalpha(soft)

    bbox = soft.getbbox()
    if bbox:
        rgba = rgba.crop(bbox)
    return rgba


def fit(img: Image.Image, size: int = CANVAS, bottom_pad: int = 6) -> Image.Image:
    """Fit a sprite into a square transparent canvas, aligned to the bottom."""
    img = img.copy()
    max_w, max_h = size - 16, size - 12
    img.thumbnail((max_w, max_h), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(img, ((size - img.width) // 2, size - img.height - bottom_pad))
    return canvas


def stretch_frame(img: Image.Image, factor_x: float = 1.14, factor_y: float = 0.92) -> Image.Image:
    """A cheap but convincing 'stretching' pose."""
    w, h = img.size
    nw, nh = int(w * factor_x), int(h * factor_y)
    resized = img.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    canvas.alpha_composite(resized, (max(0, (w - nw) // 2), h - nh))
    return canvas


def save_pair(name: str, img: Image.Image) -> None:
    img.save(OUT / f"{name}.png")
    img.transpose(Image.Transpose.FLIP_LEFT_RIGHT).save(OUT / f"{name}_left.png")


def soft_badge(path: Path) -> Image.Image:
    """A reliable fallback for any user photo: a round, softly feathered
    portrait sticker with a cream rim and a subtle drop shadow. No matting
    needed, so complex backgrounds always look intentional."""
    src = Image.open(path).convert("RGBA")
    w, h = src.size
    side = min(w, h)
    src = src.crop(((w - side) // 2, (h - side) // 2,
                    (w + side) // 2, (h + side) // 2)).resize((268, 268), Image.LANCZOS)

    hard = Image.new("L", (268, 268), 0)
    ImageDraw.Draw(hard).ellipse([8, 8, 260, 260], fill=255)
    feathered = hard.filter(ImageFilter.GaussianBlur(9))

    ring = Image.new("RGBA", (268, 268), (255, 252, 244, 255))
    ring.putalpha(hard.filter(ImageFilter.MaxFilter(9)).point(lambda v: int(v * .85)))

    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    shadow = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse([26, CANVAS - 36, CANVAS - 26, CANVAS - 12], fill=(80, 60, 40, 60))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(9)))
    canvas.alpha_composite(ring, (16, 10))
    src.putalpha(feathered)
    canvas.alpha_composite(src, (16, 10))
    return canvas


def cartoon(kind: str) -> Image.Image:
    """Draw a soft, round mascot for species without a photo (4x supersampled)."""
    S = 4
    C = CANVAS * S
    im = Image.new("RGBA", (C, C), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    palette = {
        "rabbit":      ((247, 240, 232), (255, 252, 248), (233, 168, 174)),
        "chinchilla":  ((168, 176, 186), (214, 220, 226), (199, 176, 180)),
        "hamster":     ((226, 178, 118), (248, 226, 192), (226, 150, 142)),
        "bird":        ((245, 200, 92), (255, 226, 150), (238, 158, 122)),
    }
    body, belly, inner = palette.get(kind, palette["hamster"])

    cx, cy = C // 2, int(C * 0.62)
    bw, bh = int(C * 0.27), int(C * 0.24)

    # tail / wings / ears behind the body
    if kind == "rabbit":
        for dx in (-0.13, 0.13):
            ex = cx + int(C * dx)
            d.ellipse([ex - C * 0.055, cy - C * 0.52, ex + C * 0.055, cy - C * 0.16], fill=body)
            d.ellipse([ex - C * 0.028, cy - C * 0.49, ex + C * 0.028, cy - C * 0.20], fill=inner)
    elif kind == "chinchilla":
        d.ellipse([cx + C * 0.20, cy - C * 0.05, cx + C * 0.44, cy + C * 0.17], fill=(150, 158, 170))
        for dx in (-0.17, 0.17):
            ex = cx + int(C * dx)
            d.ellipse([ex - C * 0.075, cy - C * 0.36, ex + C * 0.075, cy - C * 0.18], fill=body)
            d.ellipse([ex - C * 0.042, cy - C * 0.33, ex + C * 0.042, cy - C * 0.21], fill=inner)
    elif kind == "hamster":
        for dx in (-0.18, 0.18):
            ex = cx + int(C * dx)
            d.ellipse([ex - C * 0.07, cy - C * 0.34, ex + C * 0.07, cy - C * 0.17], fill=body)
            d.ellipse([ex - C * 0.038, cy - C * 0.31, ex + C * 0.038, cy - C * 0.20], fill=inner)
    elif kind == "bird":
        d.ellipse([cx - C * 0.33, cy - C * 0.12, cx - C * 0.12, cy + C * 0.15], fill=(228, 176, 74))

    # body + belly
    d.ellipse([cx - bw, cy - bh, cx + bw, cy + bh], fill=body)
    d.ellipse([cx - bw * 0.62, cy - bh * 0.35, cx + bw * 0.62, cy + bh * 0.95], fill=belly)

    # head
    hy = cy - bh * 0.72
    hr = int(C * 0.165)
    d.ellipse([cx - hr, hy - hr, cx + hr, hy + hr], fill=body)
    if kind == "bird":
        d.polygon([(cx + hr * 0.7, hy), (cx + hr * 1.5, hy + hr * 0.12), (cx + hr * 0.7, hy + hr * 0.3)],
                  fill=(232, 150, 70))

    # eyes, blush, nose, mouth
    eye = (43, 38, 34)
    for dx in (-0.062, 0.062):
        ex = cx + int(C * dx)
        ey = hy - int(C * 0.012)
        r = int(C * 0.020)
        d.ellipse([ex - r, ey - r, ex + r, ey + r], fill=eye)
        d.ellipse([ex - r * 0.35, ey - r * 0.55, ex - r * 0.05, ey - r * 0.2], fill=(255, 255, 255))
        bx = ex + int(C * (0.075 if dx < 0 else -0.075))
        br = int(C * 0.026)
        d.ellipse([bx - br, hy + C * 0.045 - br, bx + br, hy + C * 0.045 + br],
                  fill=(*inner, 150))
    d.ellipse([cx - C * 0.015, hy + C * 0.035, cx + C * 0.015, hy + C * 0.058], fill=(190, 118, 112))
    d.arc([cx - C * 0.035, hy + C * 0.045, cx, hy + C * 0.085], 0, 180, fill=eye, width=max(2, S))
    d.arc([cx, hy + C * 0.045, cx + C * 0.035, hy + C * 0.085], 0, 180, fill=eye, width=max(2, S))

    # paws
    for dx in (-0.13, 0.13):
        px = cx + int(C * dx)
        d.ellipse([px - C * 0.055, cy + bh * 0.62, px + C * 0.055, cy + bh * 0.95], fill=body)

    return im.resize((CANVAS, CANVAS), Image.LANCZOS)


def build() -> None:
    photos = {
        # name: (source file, pose)
        "cat_idle":     "cat-think-poster.webp",           # tabby sitting
        "cat_walk":     "cat-stretch-720p.poster.webp",    # tabby standing
        "cat_stretch":  "cat-stretch-poster.webp",         # tabby bowing / stretching
        "cat_groom":    "cat-groom-poster.webp",           # tabby lying down
        "cat_sleep":    "cat-groom-poster.webp",
        "orange_idle":  "home-process-cat.webp",           # orange cat reclining
        "orange_sleep": "home-process-cat.webp",
        "dog_idle":     "dog-cheeks-720p.poster.webp",     # golden retriever puppy
        "dog_walk":     "dog-cheeks-720p.poster.webp",
        "dog_sleep":    "dog-cheeks-720p.poster.webp",
    }
    made = []
    for name, src in photos.items():
        p = SRC / src
        if not p.exists():
            print("  skip (missing):", src)
            continue
        sprite = fit(remove_background(p))
        if name.endswith("stretch"):
            sprite = stretch_frame(sprite)
        save_pair(name, sprite)
        made.append(name)

    for kind in ("rabbit", "chinchilla", "hamster", "bird"):
        sprite = cartoon(kind)
        save_pair(f"{kind}_idle", sprite)
        save_pair(f"{kind}_sleep", stretch_frame(sprite, 1.06, 0.86))
        made.append(kind)

    # A tiny heart used for the "pet me" particles.
    heart = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    hd = ImageDraw.Draw(heart)
    hd.ellipse([8, 8, 36, 36], fill=(232, 116, 124, 255))
    hd.ellipse([28, 8, 56, 36], fill=(232, 116, 124, 255))
    hd.polygon([(6, 27), (58, 27), (32, 58)], fill=(232, 116, 124, 255))
    heart.save(OUT / "heart.png")
    made.append("heart")

    print("generated", len(made), "sprite sets ->", OUT)
    print(", ".join(made))


if __name__ == "__main__":
    build()

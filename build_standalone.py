"""Build a fully self-contained single-file HTML for 望崽宠乐园.

Everything (CSS, JS, QR codes, showcase images, pet sprites) is inlined as
data URIs, so the page works from file://, inside an iframe, offline, and when
sent as a file over WeChat - with zero external requests.

The published entry point web/index.html IS the standalone file (the hosting
platform blocks any follow-up asset request when the visitor's browser has no
session cookie). web/index-src.html is the readable multi-file source.

Usage:  python build_standalone.py
Output: web/index.html, ./望崽宠乐园-单文件版.html
"""
from __future__ import annotations

import base64
import io
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
WEB = ROOT / "web"
ASSETS = WEB / "assets"
SITE_URL = "https://dengdeng-pet-07104.app.workbuddy.host/"
SHARE_CODE = "G672SI7TFH"

MIME = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp", ".svg": "image/svg+xml", ".gif": "image/gif",
}

# Shrink bulky photos while keeping QR codes scannable and sprites lossless.
MAX_SIDE = {"showcase": 900, "qr": 560}


def encode(path: Path, kind: str | None = None, quality: int = 84) -> str:
    """Return a data: URI for an asset, downscaling big raster images."""
    suffix = path.suffix.lower()
    mime = MIME.get(suffix, "application/octet-stream")
    if suffix == ".svg":
        return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()

    im = Image.open(path)
    if suffix in (".jpg", ".jpeg") and im.mode != "RGB":
        im = im.convert("RGB")
    if kind in MAX_SIDE:
        side = MAX_SIDE[kind]
        if max(im.size) > side:
            im.thumbnail((side, side), Image.LANCZOS)
    buf = io.BytesIO()
    if suffix == ".png":
        im.save(buf, "PNG", optimize=True)
    else:
        im.save(buf, "JPEG" if suffix in (".jpg", ".jpeg") else "WEBP",
                quality=quality, method=6 if suffix == ".webp" else 0)
    # JPEG/webp output uses the corresponding mime, not the source suffix.
    out_mime = "image/jpeg" if suffix in (".jpg", ".jpeg") else mime
    return f"data:{out_mime};base64," + base64.b64encode(buf.getvalue()).decode()


def collect() -> dict[str, str]:
    mapping: dict[str, str] = {}

    # All pet sprites (transparent PNGs) - needed by the packer and preview.
    for p in sorted((ASSETS / "pet").glob("*.png")):
        if p.name.startswith(".") or p.name == "my-pet.png":
            continue
        mapping[f"assets/pet/{p.name}"] = encode(p)

    # Contact / WeChat QR codes.
    for p in sorted((ASSETS / "qr").glob("*.jpg")):
        mapping[f"assets/qr/{p.name}"] = encode(p, "qr", quality=88)

    # Showcase / process images referenced by HTML and the gallery JS.
    for p in sorted(ASSETS.glob("*")):
        if not p.is_file() or p.suffix.lower() not in (".webp", ".png", ".jpg", ".svg"):
            continue
        key = f"assets/{p.name}"
        if key in mapping:
            continue
        mapping[key] = encode(p, "showcase" if p.suffix.lower() in (".webp", ".jpg") else None)
    return mapping


def inline_js(src: str, keys: list[str]) -> str:
    """Rewrite *complete* asset paths in JS to use the injected __A() helper.

    Only exact, existing asset keys are rewritten. Partial paths (a directory
    prefix such as 'assets/pet/') and ZIP entry names must stay untouched.
    """
    # 1. Dynamic sprite path in app.js.
    src = src.replace("`assets/pet/${name}.png`", "__A('assets/pet/' + name + '.png')")
    # 2. Dynamic sprite loading in export.js (ZIP entry names stay verbatim).
    src = src.replace(
        "global.PET_PACK.loadImage((opts.assetBase || 'assets/pet/') + n + '.png')",
        "global.PET_PACK.loadImage(__A((opts.assetBase || 'assets/pet/') + n + '.png'))",
    )
    # 3. Exact literal paths only, longest first to avoid prefix collisions.
    #    Dynamic expressions from steps 1/2 use partial paths, so they are
    #    never matched here and need no cleanup.
    for key in sorted(keys, key=len, reverse=True):
        src = src.replace("'" + key + "'", "__A('" + key + "')")
        src = src.replace('"' + key + '"', '__A("' + key + '")')
    return src


def main() -> None:
    mapping = collect()
    total_raw = sum(len(v) for v in mapping.values())
    print(f"inlined {len(mapping)} assets, {total_raw/1024/1024:.2f} MB of base64")

    html = (WEB / "index-src.html").read_text(encoding="utf-8")

    # 1. Inject the asset lookup table BEFORE every other script.
    import json
    bootstrap = (
        "<script>\nwindow.__ASSETS = " +
        json.dumps(mapping, ensure_ascii=False, separators=(",", ":")) +
        ";\nwindow.__A = function (p) { return window.__ASSETS[p] || p; };\n</script>\n"
    )
    html = html.replace("<link rel=\"stylesheet\" href=\"styles.css\" />",
                        bootstrap + "<style>\n" + (WEB / "styles.css").read_text(encoding="utf-8") + "\n</style>")

    # 2. Replace static HTML asset attributes with data URIs.
    def static_attr(m: re.Match) -> str:
        attr, path = m.group(1), m.group(2)
        return f'{attr}="{mapping.get(path, path)}"'
    html = re.sub(r'(src|href)="(assets/[^"]+)"', static_attr, html)

    # 3. Inline every external script, in document order.
    def script_tag(m: re.Match) -> str:
        name = m.group(1)
        f = WEB / name
        if not f.exists():
            return m.group(0)
        code = f.read_text(encoding="utf-8")
        if name.endswith(".js") and name != "assets/qrcode.min.js":
            code = inline_js(code, list(mapping.keys()))
        return "<script>\n" + code + "\n</script>"
    html = re.sub(r'<script src="([^"]+)"></script>', script_tag, html)

    # 4. file:// compatibility: share links must point to the live site.
    #    history.replaceState is already wrapped in try/catch in app.js.
    html = html.replace(
        "return location.origin + location.pathname + '?' + p.toString();",
        "var base = (location.protocol === 'file:' || location.origin === 'null') ? '" + SITE_URL + "' : location.origin + location.pathname;\n    return base + '?' + p.toString();",
    )
    # 5. Embed the generic EXE engine so the single file can build a custom
    #    EXE package with zero network requests. The multi-file build fetches
    #    the same binary from download/wangzai-pet.exe instead.
    engine = WEB / "download" / "wangzai-pet.exe"
    if engine.exists():
        b64 = base64.b64encode(engine.read_bytes()).decode("ascii")
        html = html.replace("</body>",
                            '<script type="text/plain" id="petEngineB64">'
                            + b64 + "</script>\n</body>")
        print("embedded EXE engine:", f"{len(b64)/1024/1024:.2f} MB of base64")

    # 6. Add a small offline notice so users understand what they have.
    notice = (
        '<div id="offlineBadge" style="display:none;position:fixed;right:12px;bottom:12px;z-index:80;'
        'background:#fffdf8;border:1px solid #e0d2bf;border-radius:10px;'
        'padding:6px 10px;font:11px/1.5 sans-serif;color:#6e6257;box-shadow:0 4px 14px rgba(86,60,34,.08)">'
        '单文件版 · 离线可用 · 可直接转发此 HTML 文件</div>\n'
        '<script>if (location.protocol === "file:") '
        'document.getElementById("offlineBadge").style.display = "block";</script>'
    )
    html = html.replace("</body>", notice + "\n</body>")

    entry = WEB / "index.html"          # published entry = self-contained
    entry.write_text(html, encoding="utf-8")
    copy = ROOT / "望崽宠乐园-单文件版.html"
    copy.write_text(html, encoding="utf-8")
    print("built:", entry, f"{entry.stat().st_size/1024/1024:.2f} MB")
    print("copy :", copy)

    leftovers = re.findall(r'(?:src|href)="(assets/[^"]+)"', html)
    print("unresolved static asset refs:", leftovers or "none")


if __name__ == "__main__":
    main()

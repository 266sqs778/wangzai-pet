# -*- coding: utf-8 -*-
"""生成【望崽宠乐园】微信传播物料。

产出（promo/ 目录）：
  望崽宠乐园-扫码直达.png      纯二维码，可贴公众号图文 / 群公告 / 名片
  望崽宠乐园-微信宣传海报.png   1080x1440 竖版主海报，直接发微信群 / 朋友圈
  望崽宠乐园-朋友圈方图.png    1080x1080 方图，适合九宫格与头像位
  微信分享文案.txt             可直接复制的转发话术 + 完整链接

二维码内容恒为带 sharecode 的完整链接，扫码即自动带参，避开平台 403 门禁。
"""
import os
import qrcode
from qrcode.constants import ERROR_CORRECT_H
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "promo")
ASSETS = os.path.join(ROOT, "web", "assets")
SITE_URL = "https://dengdeng-pet-07104.app.workbuddy.host/?sharecode=G672SI7TFH"

FONT_BD = r"C:\Windows\Fonts\msyhbd.ttc"
FONT_RG = r"C:\Windows\Fonts\msyh.ttc"

INK = (49, 36, 27, 255)
BROWN = (126, 92, 64, 255)
ORANGE = (232, 132, 60, 255)
CREAM_TOP = (255, 249, 239)
CREAM_BOT = (255, 227, 202)
WHITE = (255, 255, 255, 255)


def font(size, bold=False):
    return ImageFont.truetype(FONT_BD if bold else FONT_RG, size)


def gradient(w, h, top=CREAM_TOP, bottom=CREAM_BOT):
    im = Image.new("RGBA", (w, h))
    d = ImageDraw.Draw(im)
    for y in range(h):
        t = y / max(1, h - 1)
        c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)) + (255,)
        d.line([(0, y), (w, y)], fill=c)
    return im


def center_text(d, cx, cy, text, fnt, fill=INK, anchor="mm"):
    d.text((cx, cy), text, font=fnt, fill=fill, anchor=anchor)


def round_card(base, box, radius, fill=WHITE, shadow=True):
    if shadow:
        sh = Image.new("RGBA", base.size, (0, 0, 0, 0))
        sd = ImageDraw.Draw(sh)
        off = (box[0] + 5, box[1] + 14, box[2] + 5, box[3] + 14)
        sd.rounded_rectangle(off, radius=radius, fill=(120, 82, 50, 46))
        base = Image.alpha_composite(base, sh.filter(ImageFilter.GaussianBlur(22)))
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle(box, radius=radius, fill=fill)
    return Image.alpha_composite(base, layer)


def paw(d, cx, cy, s, color):
    """一只小爪印装饰。"""
    d.ellipse([cx - s * 0.55, cy - s * 0.1, cx + s * 0.55, cy + s], fill=color)
    for dx, dy in [(-0.95, -0.62), (-0.34, -0.95), (0.34, -0.95), (0.95, -0.62)]:
        r = s * 0.27
        x, y = cx + dx * s, cy + dy * s
        d.ellipse([x - r, y - r, x + r, y + r], fill=color)


def build_qr(url, size, with_logo=True):
    """生成整数倍模块、无缩放失真的二维码。

    关键点：先用 box_size=1 探测模块数，再按目标尺寸取整数放大倍数，
    绝不把大图 NEAREST 缩小 —— 缩小会让模块宽度不均，扫码器识别率骤降。
    中心 logo 直径控制在二维码主体 13% 左右，留足 H 级纠错余量。
    """
    probe = qrcode.QRCode(version=None, error_correction=ERROR_CORRECT_H,
                          box_size=1, border=0)
    probe.add_data(url)
    probe.make(fit=True)
    border = 4
    modules = probe.modules_count + 2 * border
    scale = max(1, size // modules)

    qr = qrcode.QRCode(version=probe.version, error_correction=ERROR_CORRECT_H,
                       box_size=scale, border=border)
    qr.add_data(url)
    qr.make(fit=False)
    core_img = qr.make_image(fill_color=(43, 32, 24), back_color="white").convert("RGBA")
    core = modules * scale

    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    off = (size - core) // 2
    canvas.alpha_composite(core_img, (off, off))

    if with_logo:
        d = ImageDraw.Draw(canvas)
        r = max(10, int(core * 0.065))
        cx = cy = size // 2
        pad = max(5, int(core * 0.012))
        d.ellipse([cx - r - pad, cy - r - pad, cx + r + pad, cy + r + pad],
                  fill=(255, 255, 255, 255))
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ORANGE)
        d.text((cx, cy), "崽", font=font(int(r * 1.25), True),
               fill=(255, 255, 255, 255), anchor="mm")
    return canvas


def pet(name, max_size):
    im = Image.open(os.path.join(ASSETS, name)).convert("RGBA")
    im.thumbnail(max_size, Image.LANCZOS)
    return im


def draw_window(d, box, title):
    """桌面窗口示意框。"""
    x0, y0, x1, y1 = box
    d.rounded_rectangle(box, radius=26, fill=(255, 255, 255, 255), outline=(238, 219, 198, 255), width=3)
    d.rounded_rectangle([x0, y0, x1, y0 + 62], radius=26, fill=(250, 240, 228, 255))
    d.rectangle([x0, y0 + 36, x1, y0 + 62], fill=(250, 240, 228, 255))
    for i, c in enumerate([(238, 108, 96, 255), (243, 190, 78, 255), (126, 196, 128, 255)]):
        cx = x0 + 38 + i * 30
        d.ellipse([cx - 8, y0 + 31 - 8, cx + 8, y0 + 31 + 8], fill=c)
    center_text(d, (x0 + x1) // 2, y0 + 31, title, font(22), BROWN)


def qr_plain():
    """纯二维码贴图，适合公众号图文 / 群公告 / 名片。"""
    w, h = 1000, 1180
    im = Image.new("RGBA", (w, h), WHITE)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, w, 250], radius=0, fill=(255, 246, 234, 255))
    center_text(d, w // 2, 82, "万界店长 · 模因公社 出品", font(26), BROWN)
    center_text(d, w // 2, 158, "望 崽 宠 乐 园", font(64, True), INK)
    center_text(d, w // 2, 226, "把你家毛孩子，带到电脑桌面", font(28), BROWN)

    q = build_qr(SITE_URL, 720, with_logo=True)
    im.alpha_composite(q, ((w - 720) // 2, 280))
    d = ImageDraw.Draw(im)
    center_text(d, w // 2, 1050, "微信扫一扫 · 免费定制专属桌宠", font(34, True), INK)
    center_text(d, w // 2, 1102, "完全免费  ·  照片只在本机处理，不上传  ·  Windows 免安装", font(22), BROWN)
    d.rounded_rectangle([60, 1136, w - 60, 1140], radius=2, fill=(238, 219, 198, 255))
    return im.convert("RGB")


def poster(w=1080, h=1440, square=False):
    im = gradient(w, h)
    d = ImageDraw.Draw(im)

    # 角落装饰
    for (cx, cy, s, col) in [(70, 250, 22, (255, 214, 180, 120)), (w - 66, 190, 16, (255, 214, 180, 120)),
                            (w - 90, 620, 20, (255, 214, 180, 110)), (58, 700, 15, (255, 214, 180, 110))]:
        paw(d, cx, cy, s, col)

    if square:
        center_text(d, w // 2, 54, "万界店长 · 模因公社 出品", font(23), BROWN)
        center_text(d, w // 2, 126, "望 崽 宠 乐 园", font(70, True), INK)
        center_text(d, w // 2, 196, "把你家毛孩子，带到电脑桌面", font(29), BROWN)
        win_box = (70, 226, w - 70, 566)
        qr_card = (70, 588, w - 70, 974)
        qr_size, qr_y = 270, 650
        title_size, tip_size = 30, 20
        foot_top, cs = 984, 84
    else:
        center_text(d, w // 2, 68, "万界店长 · 模因公社 出品", font(26), BROWN)
        center_text(d, w // 2, 152, "望 崽 宠 乐 园", font(88, True), INK)
        center_text(d, w // 2, 240, "把你家毛孩子，带到电脑桌面", font(34), BROWN)
        # 三个卖点胶囊
        labels = ["上传照片", "免费定制", "一键上桌"]
        total = 3 * 190 + 2 * 22
        sx = (w - total) // 2
        for i, t in enumerate(labels):
            x0 = sx + i * (190 + 22)
            d.rounded_rectangle([x0, 288, x0 + 190, 338], radius=25, fill=(255, 255, 255, 210))
            center_text(d, x0 + 95, 313, t, font(25, True), (196, 106, 48, 255))
        win_box = (78, 372, w - 78, 780)
        qr_card = (78, 806, w - 78, 1306)
        qr_size, qr_y = 340, 878
        title_size, tip_size = 34, 22
        foot_top, cs = 1318, 104

    # 宠物桌面窗口：宠物高度严格限制在内容区内，避免压住标题栏
    im = round_card(im, win_box, 30)
    d = ImageDraw.Draw(im)
    draw_window(d, win_box, "望崽的桌面 · 会走动 · 会眨眼 · 会睡觉 · 能置顶")
    content_top = win_box[1] + 62
    content_bottom = win_box[3] - 18
    d.rectangle([win_box[0] + 3, content_top, win_box[2] - 3, content_bottom], fill=(255, 250, 242, 255))

    avail_h = content_bottom - content_top - 22
    dog = pet("dog-cheeks-720p.poster.webp", (350, avail_h))
    cat = pet("cat-think-poster.webp", (350, avail_h))
    im.alpha_composite(dog, (win_box[0] + 78, content_bottom - dog.height))
    im.alpha_composite(cat, (win_box[2] - 78 - cat.width, content_bottom - cat.height))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([win_box[0] + 3, content_bottom - 4, win_box[2] - 3, content_bottom],
                        fill=(238, 219, 198, 255))

    # 二维码卡片
    im = round_card(im, qr_card, 34)
    d = ImageDraw.Draw(im)
    center_text(d, w // 2, qr_card[1] + 38, "微信扫一扫 · 立刻领一只专属桌宠", font(title_size, True), INK)
    q = build_qr(SITE_URL, qr_size, with_logo=True)
    im.alpha_composite(q, ((w - qr_size) // 2, qr_y))
    d = ImageDraw.Draw(im)
    center_text(d, w // 2, qr_y + qr_size + 30,
                "扫码后点右上角「免费定制」，上传照片即可生成", font(tip_size), BROWN)
    if not square:
        center_text(d, w // 2, qr_y + qr_size + 64,
                    "完全免费 · 无需注册 · 照片只在本机处理，不上传", font(20), (160, 124, 96, 255))

    # 底部：所属机构 + 店主微信二维码（与上方卡片留白分离，不重叠）
    d = ImageDraw.Draw(im)
    contact = Image.open(os.path.join(ASSETS, "qr", "wx-lengshi.jpg")).convert("RGB")
    contact = contact.resize((cs, cs), Image.LANCZOS)
    cx0, cy0 = w - 78 - cs, foot_top
    d.rounded_rectangle([cx0 - 8, cy0 - 8, cx0 + cs + 8, cy0 + cs + 8], radius=14, fill=WHITE)
    im.paste(contact, (cx0, cy0))
    d = ImageDraw.Draw(im)
    org_size = 24 if square else 27
    sub_size = 18 if square else 21
    line1 = foot_top + int(cs * 0.32)
    center_text(d, 78, line1, "万界店长 · 模因公社  所属", font(org_size, True), INK, anchor="lm")
    center_text(d, 78, line1 + (30 if square else 38),
                "定制 / 合作 / 进群，扫码加店主微信", font(sub_size), BROWN, anchor="lm")
    return im.convert("RGB")


def main():
    os.makedirs(OUT, exist_ok=True)
    files = {
        "望崽宠乐园-扫码直达.png": qr_plain(),
        "望崽宠乐园-微信宣传海报.png": poster(),
        "望崽宠乐园-朋友圈方图.png": poster(1080, 1080, square=True),
    }
    for name, img in files.items():
        p = os.path.join(OUT, name)
        img.save(p, "PNG", optimize=True)
        print("saved", p, img.size, os.path.getsize(p), "bytes")

    copy = f"""【望崽宠乐园】把你家毛孩子，带到电脑桌面

上传一张自家宠物照片 → 起名字、加台词 → 一键生成免安装桌宠。
会走动、会眨眼、会睡觉，还能置顶陪你加班。

扫码或点链接，免费定制：
{SITE_URL}

· 完全免费，无需注册，照片只在本机浏览器处理，不上传服务器
· Windows 电脑：下载 ZIP 解压，双击 start.bat 就上桌
· 链接请整条复制，末尾的 ?sharecode=G672SI7TFH 不能丢，丢了会打不开
· 若微信内打不开：点右上角「···」→ 在浏览器中打开，或向店主索取「单文件版 HTML」

—— 万界店长 · 模因公社 出品
"""
    p = os.path.join(OUT, "微信分享文案.txt")
    with open(p, "w", encoding="utf-8") as fp:
        fp.write(copy)
    print("saved", p)

    # 解码自检：确认中心 logo 没有破坏可读性
    try:
        from pyzbar.pyzbar import decode
        for name in ("望崽宠乐园-扫码直达.png", "望崽宠乐园-微信宣传海报.png"):
            img = Image.open(os.path.join(OUT, name))
            hits = [x.data.decode() for x in decode(img)]
            ok = SITE_URL in hits
            print("QR CHECK", name, "->", "OK" if ok else "FAILED", hits[:1])
    except Exception as e:
        print("QR CHECK skipped:", e)


if __name__ == "__main__":
    main()

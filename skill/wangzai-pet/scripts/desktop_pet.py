# -*- coding: utf-8 -*-
"""
Wangzai desktop pet - a transparent, always-on-top window for Windows.

Zero third-party runtime deps: tkinter + Pillow (Pillow is only used to build
the sprite bitmaps). It polls pet-config.json, so the local web console can
control it live; it also works standalone.

Interactions:
  drag        move the pet anywhere
  click       it says hello
  double tap  pet it (hearts + happy wiggle)
  wheel       resize
  right click menu: poses, settings, hide, quit
"""
from __future__ import annotations

import json
import math
import os
import random
import time
import tkinter as tk
from pathlib import Path

from PIL import Image

# In a frozen EXE, __file__ points at PyInstaller's temp folder. The bundled
# entry point sets DENGPET_HOME to the folder that actually holds the EXE, so
# user-editable config and sprites live next to the executable.
ROOT = Path(os.environ.get("DENGPET_HOME") or Path(__file__).resolve().parent).resolve()
PET_DIR = ROOT / "assets" / "pet"
CONFIG = ROOT / "pet-config.json"
RUNTIME = ROOT / "runtime.json"

KEY_COLOR = "#ff00ff"          # colour-key transparency (Windows)
WARM = (246, 238, 226, 255)    # edge matte, keeps fur from getting a dark fringe
BUBBLE_H = 54

DEFAULTS = {
    "name": "望崽", "species": "cat", "size": 220, "speed": 2,
    "opacity": 1.0, "topmost": True, "auto": True, "visible": True,
    "action": "idle", "seq": 0, "command": {"type": "idle"},
    "lines": ["在呢，一直都在。", "今天也要好好工作呀～", "摸摸我就有精神啦！"],
}

POSES = {
    "cat":     dict(idle="cat_idle", walk="cat_walk", stretch="cat_stretch", groom="cat_groom", sleep="cat_sleep", happy="cat_idle"),
    "orange":  dict(idle="orange_idle", walk="cat_walk", stretch="cat_stretch", groom="cat_groom", sleep="orange_sleep", happy="orange_idle"),
    "dog":     dict(idle="dog_idle", walk="dog_walk", stretch="dog_idle", groom="dog_idle", sleep="dog_sleep", happy="dog_idle"),
    "rabbit":  dict(idle="rabbit_idle", walk="rabbit_idle", stretch="rabbit_idle", groom="rabbit_idle", sleep="rabbit_sleep", happy="rabbit_idle"),
    "chinchilla": dict(idle="chinchilla_idle", walk="chinchilla_idle", stretch="chinchilla_idle", groom="chinchilla_idle", sleep="chinchilla_sleep", happy="chinchilla_idle"),
    "hamster": dict(idle="hamster_idle", walk="hamster_idle", stretch="hamster_idle", groom="hamster_idle", sleep="hamster_sleep", happy="hamster_idle"),
    "bird":    dict(idle="bird_idle", walk="bird_idle", stretch="bird_idle", groom="bird_idle", sleep="bird_sleep", happy="bird_idle"),
    "my":      dict(idle="my-pet", walk="my-pet", stretch="my-pet", groom="my-pet", sleep="my-pet", happy="my-pet"),
}

ACTION_LABELS = {
    "idle": "发呆", "walk": "散步", "stretch": "伸懒腰",
    "groom": "舔毛毛", "sleep": "睡觉", "happy": "摸摸", "feed": "喂零食",
}


def load_config() -> dict:
    try:
        data = json.loads(CONFIG.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        data = {}
    cfg = dict(DEFAULTS)
    cfg.update(data)
    return cfg


def save_config(patch: dict) -> dict:
    cfg = load_config()
    cfg.update(patch)
    cfg["seq"] = int(cfg.get("seq", 0)) + 1
    tmp = CONFIG.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(CONFIG)
    return cfg


class DesktopPet:
    def __init__(self):
        self.cfg = load_config()
        self.size = int(self.cfg["size"])
        self.state = "idle"
        self.state_until = 0.0
        self.seq = int(self.cfg.get("seq", 0))
        self.face = 1                      # 1 = right, -1 = left
        self.tick_n = 0
        self.bubble_until = 0.0
        self.hearts = []
        self.last_auto = time.time()
        self.photo_cache = {}
        self._drag = None
        self._settings_win = None

        self.root = tk.Tk()
        self.root.overrideredirect(True)
        self.root.attributes("-topmost", bool(self.cfg["topmost"]))
        try:
            self.root.attributes("-transparentcolor", KEY_COLOR)
            self.root.configure(bg=KEY_COLOR)
            self.color_key = True
        except tk.TclError:
            self.color_key = False
            self.root.configure(bg="#f6eee2")
        try:
            self.root.attributes("-alpha", float(self.cfg["opacity"]))
        except tk.TclError:
            pass

        self.canvas = tk.Canvas(
            self.root, width=self.size, height=self.size + BUBBLE_H,
            bg=KEY_COLOR if self.color_key else "#f6eee2",
            highlightthickness=0, bd=0,
        )
        self.canvas.pack()

        sw = self.root.winfo_screenwidth()
        sh = self.root.winfo_screenheight()
        x = self.cfg.get("x")
        y = self.cfg.get("y")
        if not isinstance(x, int) or not isinstance(y, int):
            x, y = sw - self.size - 70, sh - self.size - BUBBLE_H - 90
        self.x, self.y = x, y
        self.apply_geometry()

        self.pet_item = self.canvas.create_image(self.size // 2, BUBBLE_H + self.size // 2)
        self.bubble_bg = self.canvas.create_rectangle(0, 0, 0, 0, fill="#fffaf0", outline="#e0d2bf", width=1)
        self.bubble_tx = self.canvas.create_text(0, 0, text="", fill="#49392d", font=("Microsoft YaHei", 10))
        self.zzz = self.canvas.create_text(0, 0, text="", fill="#8a7a68", font=("Microsoft YaHei", 12, "bold"))
        for item in (self.bubble_bg, self.bubble_tx, self.zzz):
            self.canvas.itemconfigure(item, state="hidden")

        self.heart_img = self.build_photo("heart", 26, 1)
        self.refresh_sprite(force=True)
        self.bind_events()
        self.heartbeat()
        self.root.after(60, self.tick)

    # ---------- rendering ----------
    def build_photo(self, stem: str, size: int, face: int) -> tk.PhotoImage:
        key = (stem, size, face)
        if key in self.photo_cache:
            return self.photo_cache[key]
        path = PET_DIR / f"{stem}{'' if face == 1 else '_left'}.png"
        if not path.exists():
            path = PET_DIR / f"{stem}.png"
        if not path.exists():
            path = PET_DIR / "cat_idle.png"

        img = Image.open(path).convert("RGBA")
        if face == -1 and not str(path).endswith("_left.png"):
            img = img.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        img = img.resize((size, size), Image.LANCZOS)
        alpha = img.getchannel("A")
        matte = Image.new("RGBA", (size, size), WARM)
        comp = Image.alpha_composite(matte, img).convert("RGB")
        # Fully transparent pixels become the colour key -> real desktop shows through.
        mask = alpha.point(lambda a: 255 if a < 8 else 0)
        comp.paste(KEY_COLOR, (0, 0), mask)
        tmp = PET_DIR / ".frame.png"
        comp.save(tmp, "PNG")
        photo = tk.PhotoImage(file=str(tmp))
        self.photo_cache[key] = photo
        if len(self.photo_cache) > 60:
            self.photo_cache.clear()
            self.photo_cache[key] = photo
        return photo

    def sprite_stem(self) -> str:
        poses = POSES.get(str(self.cfg.get("species", "cat")), POSES["cat"])
        return poses.get(self.state, poses["idle"])

    def refresh_sprite(self, force: bool = False) -> None:
        photo = self.build_photo(self.sprite_stem(), self.size, self.face)
        if force or getattr(self, "_photo", None) is not photo:
            self.canvas.itemconfigure(self.pet_item, image=photo)
            self._photo = photo

    def apply_geometry(self) -> None:
        self.root.geometry(f"{self.size}x{self.size + BUBBLE_H}+{self.x}+{self.y}")

    def show_bubble(self, text: str, seconds: float = 3.2) -> None:
        text = (text or "").strip()
        if not text:
            return
        if len(text) > 22:
            text = text[:21] + "…"
        w = min(self.size - 8, max(58, len(text) * 15 + 22))
        cx, cy = self.size // 2, BUBBLE_H // 2 + 2
        self.canvas.coords(self.bubble_bg, cx - w / 2, cy - 17, cx + w / 2, cy + 17)
        self.canvas.coords(self.bubble_tx, cx, cy)
        self.canvas.itemconfigure(self.bubble_tx, text=text)
        self.canvas.itemconfigure(self.bubble_bg, state="normal")
        self.canvas.itemconfigure(self.bubble_tx, state="normal")
        self.canvas.tag_raise(self.bubble_bg)
        self.canvas.tag_raise(self.bubble_tx)
        self.bubble_until = time.time() + seconds

    def spawn_hearts(self, n: int = 4) -> None:
        for i in range(n):
            x = self.size // 2 + random.randint(-self.size // 5, self.size // 5)
            y = BUBBLE_H + self.size // 3
            item = self.canvas.create_image(x, y, image=self.heart_img)
            self.hearts.append([item, 0, random.uniform(1.1, 2.3)])

    def say(self, text: str | None = None) -> None:
        lines = self.cfg.get("lines") or DEFAULTS["lines"]
        self.show_bubble(text or random.choice(lines))

    def persist(self, patch: dict) -> dict:
        """Write local changes without replaying the last remote command."""
        data = dict(patch)
        data["command"] = {"type": "noop"}
        cfg = save_config(data)
        self.seq = int(cfg.get("seq", self.seq))
        return cfg

    # ---------- interaction ----------
    def bind_events(self) -> None:
        c = self.canvas
        c.bind("<ButtonPress-1>", self.on_press)
        c.bind("<B1-Motion>", self.on_drag)
        c.bind("<ButtonRelease-1>", self.on_release)
        c.bind("<Double-Button-1>", lambda e: self.do_action("happy"))
        c.bind("<Button-3>", self.on_menu)
        c.bind("<MouseWheel>", self.on_wheel)

    def on_press(self, event) -> None:
        self._drag = (event.x, event.y, self.x, self.y)

    def on_drag(self, event) -> None:
        if not self._drag:
            return
        ox, oy, sx, sy = self._drag
        self.x, self.y = sx + event.x - ox, sy + event.y - oy
        self.apply_geometry()

    def on_release(self, event) -> None:
        if self._drag:
            moved = abs(event.x - self._drag[0]) + abs(event.y - self._drag[1])
            self._drag = None
            if moved < 5:
                self.say()
            else:
                self.persist({"x": self.x, "y": self.y})

    def on_wheel(self, event) -> None:
        delta = 12 if event.delta > 0 else -12
        self.set_size(max(100, min(420, self.size + delta)))
        self.persist({"size": self.size})

    def set_size(self, size: int) -> None:
        self.size = int(size)
        self.canvas.config(width=self.size, height=self.size + BUBBLE_H)
        self.apply_geometry()
        self.canvas.coords(self.pet_item, self.size // 2, BUBBLE_H + self.size // 2)
        self.heart_img = self.build_photo("heart", 26, 1)
        self.refresh_sprite(force=True)

    def on_menu(self, event) -> None:
        menu = tk.Menu(self.root, tearoff=0, font=("Microsoft YaHei", 10))
        menu.add_command(label=f"  {self.cfg.get('name', '望崽')}  ·  摸摸我", command=lambda: self.do_action("happy"))
        menu.add_separator()
        for key in ("idle", "walk", "stretch", "groom", "sleep"):
            menu.add_command(label="  " + ACTION_LABELS[key], command=lambda k=key: self.do_action(k))
        menu.add_separator()
        menu.add_command(label="  换个心情 / 说句话", command=lambda: self.say())
        menu.add_command(label="  尺寸 +", command=lambda: self.set_size(min(420, self.size + 20)))
        menu.add_command(label="  尺寸 −", command=lambda: self.set_size(max(100, self.size - 20)))
        menu.add_command(label="  置顶开关", command=self.toggle_topmost)
        menu.add_command(label="  设置面板…", command=self.open_settings)
        menu.add_separator()
        menu.add_command(label="  暂时藏起来", command=self.hide)
        menu.add_command(label="  退出桌宠", command=self.quit)
        try:
            menu.tk_popup(event.x_root, event.y_root)
        finally:
            menu.grab_release()

    def toggle_topmost(self) -> None:
        value = not bool(self.cfg.get("topmost"))
        self.cfg["topmost"] = value
        self.root.attributes("-topmost", value)
        self.persist({"topmost": value})
        self.show_bubble("置顶已" + ("开启" if value else "关闭"))

    def hide(self) -> None:
        self.show_bubble("我先睡一会儿～")
        self.root.after(900, self.root.withdraw)
        self.persist({"visible": False})

    def quit(self) -> None:
        try:
            RUNTIME.unlink(missing_ok=True)
        except OSError:
            pass
        self.root.destroy()

    # ---------- settings panel ----------
    def open_settings(self) -> None:
        if self._settings_win and self._settings_win.winfo_exists():
            self._settings_win.lift()
            return
        win = tk.Toplevel(self.root)
        win.title("望崽宠乐园 · 设置")
        win.geometry("330x420")
        win.configure(bg="#fcf8f0")
        win.attributes("-topmost", True)
        self._settings_win = win

        def row(label, widget_factory, r):
            tk.Label(win, text=label, bg="#fcf8f0", fg="#49392d",
                     font=("Microsoft YaHei", 10)).grid(row=r, column=0, sticky="w", padx=16, pady=6)
            return widget_factory(r)

        name_var = tk.StringVar(value=str(self.cfg.get("name", "望崽")))
        row("名字", lambda r: tk.Entry(win, textvariable=name_var, width=22, font=("Microsoft YaHei", 10)), 0)

        species_var = tk.StringVar(value=str(self.cfg.get("species", "cat")))
        species_names = {"cat": "虎斑猫", "orange": "橘猫", "dog": "金毛",
                         "rabbit": "兔子", "chinchilla": "龙猫", "hamster": "仓鼠",
                         "bird": "小鸟", "my": "我家宠物"}
        row("形象", lambda r: tk.OptionMenu(win, species_var, *species_names.keys()), 1)

        size_var = tk.IntVar(value=self.size)
        row("大小", lambda r: tk.Scale(win, from_=100, to=420, orient="horizontal",
                                       variable=size_var, length=180, bg="#fcf8f0"), 2)
        speed_var = tk.IntVar(value=int(self.cfg.get("speed", 2)))
        row("走动速度", lambda r: tk.Scale(win, from_=1, to=8, orient="horizontal",
                                           variable=speed_var, length=180, bg="#fcf8f0"), 3)
        opacity_var = tk.DoubleVar(value=float(self.cfg.get("opacity", 1.0)))
        row("不透明度", lambda r: tk.Scale(win, from_=0.4, to=1.0, resolution=0.05,
                                           orient="horizontal", variable=opacity_var,
                                           length=180, bg="#fcf8f0"), 4)
        auto_var = tk.BooleanVar(value=bool(self.cfg.get("auto", True)))
        row("自动换动作", lambda r: tk.Checkbutton(win, variable=auto_var, bg="#fcf8f0"), 5)
        top_var = tk.BooleanVar(value=bool(self.cfg.get("topmost", True)))
        row("窗口置顶", lambda r: tk.Checkbutton(win, variable=top_var, bg="#fcf8f0"), 6)

        def apply():
            self.cfg.update({
                "name": name_var.get(), "species": species_var.get(),
                "speed": speed_var.get(), "opacity": opacity_var.get(),
                "auto": auto_var.get(), "topmost": top_var.get(),
            })
            self.persist({k: self.cfg[k] for k in ("name", "species", "speed", "opacity", "auto", "topmost")})
            self.set_size(size_var.get())
            self.root.attributes("-topmost", top_var.get())
            try:
                self.root.attributes("-alpha", opacity_var.get())
            except tk.TclError:
                pass
            self.refresh_sprite(force=True)
            self.show_bubble("好啦，都听你的～")
            win.destroy()

        tk.Button(win, text="保存并应用", command=apply, bg="#a65334", fg="white",
                  relief="flat", font=("Microsoft YaHei", 10), width=14, pady=5).grid(
            row=7, column=0, columnspan=2, pady=14)
        tk.Label(win, text="提示：拖动宠物可移动，滚轮调整大小，右键打开菜单。",
                 bg="#fcf8f0", fg="#8a7a68", font=("Microsoft YaHei", 9),
                 wraplength=290, justify="left").grid(row=8, column=0, columnspan=2, padx=16)

    # ---------- state machine ----------
    def do_action(self, action: str, message: str = "", from_remote: bool = False) -> None:
        if action in ("feed", "happy", "pet"):
            self.state = "happy"
            self.state_until = time.time() + 2.2
            self.spawn_hearts(5)
            self.say(message or random.choice(["好舒服呀～", "嘿嘿，最喜欢你了！", "再摸一下嘛～"]))
        elif action == "sleep":
            self.state = "sleep"
            self.state_until = time.time() + 30
        elif action == "walk":
            self.state = "walk"
            self.state_until = time.time() + 18
        elif action in ("stretch", "groom"):
            self.state = action
            self.state_until = time.time() + 3.5
            if message:
                self.say(message)
        else:
            self.state = "idle"
            self.state_until = 0
            if message:
                self.say(message)
        self.last_auto = time.time()
        self.refresh_sprite()
        if not from_remote:
            self.persist({"action": self.state})

    def apply_config(self) -> None:
        self.cfg = load_config()
        size = int(self.cfg.get("size", 220))
        if size != self.size:
            self.set_size(size)
        try:
            self.root.attributes("-alpha", float(self.cfg.get("opacity", 1.0)))
            self.root.attributes("-topmost", bool(self.cfg.get("topmost", True)))
        except tk.TclError:
            pass
        if self.cfg.get("visible"):
            if self.root.state() == "withdrawn":
                self.root.deiconify()
        elif self.root.state() != "withdrawn":
            self.root.withdraw()
        self.refresh_sprite()

    def heartbeat(self) -> None:
        try:
            RUNTIME.write_text(json.dumps({"pid": os.getpid(), "ts": time.time()}), encoding="utf-8")
        except OSError:
            pass

    def tick(self) -> None:
        now = time.time()
        self.tick_n += 1

        # heartbeat once a second; poll commands ~4x a second for snappy control
        if self.tick_n % 8 == 0:
            self.heartbeat()
        if self.tick_n % 4 == 0:
            latest = load_config()
            seq = int(latest.get("seq", 0))
            if seq != self.seq:
                self.seq = seq
                cmd = latest.get("command") or {}
                ctype = cmd.get("type")
                if ctype == "quit":
                    self.quit()
                    return
                self.apply_config()
                if ctype == "action":
                    self.do_action(cmd.get("action", "idle"), cmd.get("message", ""), from_remote=True)

        # timed states
        if self.state_until and now > self.state_until:
            self.state, self.state_until = "idle", 0
            self.refresh_sprite()

        # autonomous behaviour
        if self.cfg.get("auto") and now - self.last_auto > random.uniform(11, 20) and self.state in ("idle", "walk"):
            self.last_auto = now
            pick = random.choice(["idle", "walk", "stretch", "groom", "walk", "sleep"])
            self.do_action(pick, from_remote=True)
            if pick == "idle" and random.random() < 0.5:
                self.say()

        # breathing / walking
        if self.state == "walk":
            speed = max(1, int(self.cfg.get("speed", 2)))
            self.x += self.face * speed
            sw = self.root.winfo_screenwidth()
            if self.x < -self.size // 3:
                self.x, self.face = -self.size // 3, 1
            if self.x > sw - self.size * 2 // 3:
                self.x, self.face = sw - self.size * 2 // 3, -1
            self.apply_geometry()
            bob = int(2 * math.sin(self.tick_n * 0.45))
            self.canvas.coords(self.pet_item, self.size // 2, BUBBLE_H + self.size // 2 + bob)
            self.refresh_sprite()
        else:
            bob = int(2.2 * math.sin(self.tick_n * 0.12))
            self.canvas.coords(self.pet_item, self.size // 2, BUBBLE_H + self.size // 2 + bob)

        # zzz
        if self.state == "sleep" and self.tick_n % 3 == 0:
            self.canvas.itemconfigure(self.zzz, state="normal")
            self.canvas.coords(self.zzz, self.size // 2 + 52,
                               BUBBLE_H + 28 + 6 * math.sin(self.tick_n * 0.08))
            self.canvas.itemconfigure(self.zzz, text="z Z z")
        else:
            self.canvas.itemconfigure(self.zzz, state="hidden")

        # hearts float up
        for heart in list(self.hearts):
            item, age, vy = heart
            heart[1] += 1
            self.canvas.move(item, math.sin(age * 0.3) * 1.5, -vy)
            if heart[1] > 44:
                self.canvas.delete(item)
                self.hearts.remove(heart)

        # bubble timeout
        if self.bubble_until and now > self.bubble_until:
            self.canvas.itemconfigure(self.bubble_bg, state="hidden")
            self.canvas.itemconfigure(self.bubble_tx, state="hidden")
            self.bubble_until = 0

        self.root.after(60, self.tick)

    def run(self) -> None:
        self.root.mainloop()


def already_running() -> bool:
    try:
        info = json.loads(RUNTIME.read_text(encoding="utf-8"))
        return time.time() - float(info.get("ts", 0)) < 1.5 and int(info.get("pid", -1)) != os.getpid()
    except (OSError, ValueError):
        return False


def main() -> None:
    if not CONFIG.exists():
        CONFIG.write_text(json.dumps(DEFAULTS, ensure_ascii=False, indent=2), encoding="utf-8")
    if already_running():
        print("desktop pet is already running")
        return
    DesktopPet().run()


if __name__ == "__main__":
    main()

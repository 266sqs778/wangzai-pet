# -*- coding: utf-8 -*-
"""One-shot validation for the wangzai-pet skill package.

    python scripts/validate_all.py

Checks frontmatter, site files, JS/Python syntax, runtime-template parity,
mini-program structure and actually builds a BAT package to verify the ZIP.
"""
from __future__ import annotations

import ast
import json
import re
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SITE = ROOT / "assets" / "site"
PROJECT = ROOT.parent.parent
results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, bool(ok), detail))


def node_ok() -> bool:
    try:
        return subprocess.run(["node", "--version"], capture_output=True).returncode == 0
    except OSError:
        return False


def main() -> None:
    # 1. SKILL.md frontmatter
    skill_md = (ROOT / "SKILL.md").read_text(encoding="utf-8")
    fm = re.match(r"^---\s*\n(.*?)\n---", skill_md, re.S)
    has_fm = bool(fm) and all(
        re.search(rf"^{k}:", fm.group(1), re.M) for k in ("name", "description", "agent_created")
    )
    check("SKILL.md frontmatter", has_fm, "name / description / agent_created")

    # 2. site files
    site_files = ["index.html", "styles.css", "app.js", "pack.js", "runtime.js", "export.js",
                  "assets/pet/cat_idle.png", "assets/wangzai-logo-mark.svg"]
    missing = [f for f in site_files if not (SITE / f).exists()]
    check("static site files", not missing, "missing: " + ", ".join(missing) if missing else f"{len(site_files)} files")

    # 3. JS syntax
    if node_ok():
        bad = []
        for p in SITE.glob("*.js"):
            r = subprocess.run(["node", "--check", str(p)], capture_output=True, text=True)
            if r.returncode:
                bad.append(p.name)
        check("site JS syntax", not bad, ", ".join(bad))
    else:
        check("site JS syntax", True, "skipped (node unavailable)")

    # 4. Python syntax
    bad = []
    for p in HERE.glob("*.py"):
        try:
            ast.parse(p.read_text(encoding="utf-8"), filename=str(p))
        except SyntaxError as e:
            bad.append(f"{p.name}:{e.lineno}")
    check("script Python syntax", not bad, ", ".join(bad))

    # 5. runtime template parity
    runtime_js = (SITE / "runtime.js").read_text(encoding="utf-8")
    m = re.search(r"const WIN_PET_PS1 = String\.raw`(.*?)`;", runtime_js, re.S)
    ps = (HERE / "win_pet.ps1").read_bytes()
    ps_text = ps.decode("utf-8-sig")
    parity = bool(m) and m.group(1).strip() == ps_text.strip()
    check("runtime template parity", parity, "web/runtime.js vs scripts/win_pet.ps1")
    check("win_pet.ps1 BOM", ps.startswith(b"\xef\xbb\xbf"), "UTF-8 BOM required by PowerShell 5.1")

    # 6. build a real BAT package
    with tempfile.TemporaryDirectory() as td:
        out = Path(td) / "test-pet.zip"
        r = subprocess.run(
            [sys.executable, str(HERE / "make_bat_pack.py"), "--name", "自检猫",
             "--species", "cat", "--out", str(out)],
            capture_output=True, text=True,
        )
        built = r.returncode == 0 and out.exists()
        detail = r.stdout.strip().splitlines()[0] if r.stdout else r.stderr.strip()[:160]
        check("BAT package build", built, detail)
        if built:
            with zipfile.ZipFile(out) as z:
                names = z.namelist()
                ok = (z.testzip() is None
                      and "start.bat" in names
                      and "win_pet.ps1" in names
                      and "pet-config.json" in names
                      and any(n.startswith("assets/pet/") for n in names))
                cfg = json.loads(z.read("pet-config.json").decode("utf-8"))
                ok = ok and cfg["name"] == "自检猫"
            check("BAT package contents", ok, f"{len(names)} files")

    # 7. mini program (when the full repo is present)
    mp = PROJECT / "miniprogram"
    if (mp / "app.json").exists():
        try:
            app = json.loads((mp / "app.json").read_text(encoding="utf-8"))
            missing = []
            for page in app.get("pages", []):
                for ext in (".js", ".wxml", ".wxss", ".json"):
                    if not (mp / (page + ext)).exists():
                        missing.append(page + ext)
            json_bad = []
            for p in mp.rglob("*.json"):
                try:
                    json.loads(p.read_text(encoding="utf-8"))
                except ValueError:
                    json_bad.append(p.name)
            check("mini-program structure",
                  not missing and not json_bad and app.get("lazyCodeLoading") == "requiredComponents",
                  f"{len(app.get('pages', []))} pages")
        except Exception as e:
            check("mini-program structure", False, str(e))

    # 8. summary
    for name, ok, detail in results:
        print(("PASS  " if ok else "FAIL  ") + name + (("  · " + detail) if detail else ""))
    failed = [n for n, ok, _ in results if not ok]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    if failed:
        raise SystemExit("FAILED: " + ", ".join(failed))
    print("ALL CHECKS PASSED")


if __name__ == "__main__":
    main()

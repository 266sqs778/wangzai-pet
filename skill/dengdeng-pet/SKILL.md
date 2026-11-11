---
name: dengdeng-pet
description: 复刻桌宠官网、搭建免费在线定制台、导出免安装的 Windows 桌宠包（BAT 与 EXE）、部署成可传播链接、生成微信小程序并挂到微信公众号。当用户提出「桌面宠物 / 桌宠 / 把宠物带到电脑桌面 / 宠物照片变桌宠 / 桌宠 EXE 或 BAT 分发 / 桌宠定制网站上线 / 桌宠小程序 / 公众号挂小程序 / 桌宠服务 skill 包」等需求时使用。
agent_created: true
---

# 灯灯桌宠服务 Skill

把「宠物照片 → 会动的桌面小伙伴」做成一条完整可交付的服务：官网门面、浏览器内定制、零依赖 Windows 桌宠包、在线分享链接、微信小程序引流、公众号挂载，以及全部源码与文档。

## 何时使用

- 复刻或搭建桌宠类官网，并提供访客可自助使用的定制台。
- 把定制结果导出为**对方电脑上能直接双击运行**的 BAT / EXE 桌宠包。
- 把网站发布成一条可分享的在线链接，或做成微信小程序挂到公众号。
- 把这套能力沉淀为可复用、可上传到 GitHub 的 skill 包。

## 资源地图

| 路径 | 用途 |
|---|---|
| `assets/site/` | 完整静态站点模板：`index.html` / `styles.css` / `app.js` / `pack.js` / `runtime.js` / `export.js` + `assets/`。直接复制即可运行或部署 |
| `assets/pet/*.png` | 透明桌宠精灵图（7 种形象 × 多个动作，含 `_left` 镜像） |
| `scripts/make_bat_pack.py` | 命令行生成零依赖 BAT 桌宠包，网页导出逻辑的 CLI 等价实现 |
| `scripts/build_exe.py` | 编译通用 `dengdeng-pet.exe` 并打成分发 zip |
| `scripts/win_pet.ps1` | Windows PowerShell 桌宠运行时模板（UTF-8 BOM） |
| `scripts/build_assets.py` | 从原图生成透明精灵图 |
| `scripts/desktop_pet.py` / `server.py` / `bundle_pet.py` | 功能完整的 Python 桌宠与本地控制台 |
| `scripts/validate_all.py` | 一键校验：语法、页面完整性、模板一致性、包可生成 |
| `references/官网复刻与定制台.md` | 页面结构、交互与纯前端架构 |
| `references/桌宠包格式.md` | ZIP 布局、洋红透明键、配置字段 |
| `references/URL定制参数.md` | 网页与小程序共用的分享链接协议 |
| `references/部署上线.md` | 静态部署、分享码、小程序发布路径 |
| `references/微信公众号与小程序指南.md` | 资质、注册上限、关联规则、菜单挂载 |

## 工作流

### 1. 交付一个可直接运行的网站

1. 复制 `assets/site/` 到目标目录。
2. 本地起静态服务预览（例如 `python -m http.server 8766 --directory <site>`）。
3. 定制台全部在浏览器内完成：选形象、上传照片、命名、调大小速度、加台词、预览动作。
4. 点击「免费生成桌宠包」，由 `pack.js` + `export.js` 在浏览器里组装 ZIP 并下载，不经过任何服务器。

详细结构见 `references/官网复刻与定制台.md`。

### 2. 生成并验证桌宠包

- 网页链路：定制台 → ZIP → 解压 → 双击 `start.bat`。
- 命令行链路（无需浏览器）：

```bash
python scripts/make_bat_pack.py --name 团子 --species cat --size 220 --speed 2 --out dist/tuanzi.zip
python scripts/make_bat_pack.py --photo my-cat.jpg --name 咪咪 --out dist/mimi.zip
python scripts/build_exe.py --out dist/dengdeng-pet-exe.zip
python scripts/validate_all.py
```

- 轻量 BAT 包只有几十 KB，靠 Windows 自带 PowerShell + WinForms 运行；EXE 版自带完整动作与右键菜单，约 17 MB。
- 两个包都不需要 Python、不联网、不上传照片。字段与文件布局见 `references/桌宠包格式.md`。

### 3. 发布成可传播链接

1. 静态站点无需构建，直接部署 `assets/site/` 的副本。
2. 部署工具会返回带分享码的链接；首次访问写入会话 Cookie，之后同源静态资源正常加载。
3. 把链接写入小程序 `config.js` 的 `SITE_BASE` / `SHARE_CODE`，小程序即可生成还原定制的分享链接。
4. 注意：网页发布与小程序发布是两条独立路径，网页链接不能当作小程序交付。

见 `references/部署上线.md`。

### 4. 小程序与公众号

1. 用微信开发者工具导入小程序工程，替换 `project.config.json` 里的 AppID。
2. 小程序只做「选形象 + 命名 + 生成链接」，配置存本地 storage，不发网络请求。
3. 用户把链接发到电脑浏览器打开，网页自动还原定制（协议见 `references/URL定制参数.md`）。
4. 公众号后台「小程序管理 → 添加 → 快速注册并认证小程序」创建小程序并自动关联；发布后在自定义菜单、图文卡片、自动回复、资料页挂载。
5. 数量上限按**主体**计算（个人 5 个 / 企业 50 个），备案为上架前置条件；个人主体不能用 `web-view`，所以本项目刻意不依赖它。

完整规则与操作步骤见 `references/微信公众号与小程序指南.md`。

## 关键不变量

- **透明键固定为 `#FF00FF`（纯洋红）**。WinForms 用 `TransparencyKey` 抠色，所以导出图片必须把 alpha 二值化到洋红底；不要用半透明边缘。
- **ZIP 内文件名一律 ASCII**（`start.bat` / `win_pet.ps1` / `pet-config.json` / `assets/pet/*.png`），避免 Windows 解压中文乱码；中文说明只放 `README.txt`。
- `win_pet.ps1` 必须带 **UTF-8 BOM**，否则 PowerShell 5.1 会把中文读成乱码。
- 网页 `runtime.js` 与 `scripts/win_pet.ps1` 是同一份运行时的两份副本；`validate_all.py` 会校验一致，改动时同步两边。
- 配置唯一来源是 `pet-config.json`；网页、BAT 包、EXE 包都读它。
- 全程无后端、无数据库、无用户登录；照片只在浏览器本地处理。
- 站点展示素材为原站演示素材，**商用前必须替换为自有图片与品牌名称**。

## 校验

```bash
python scripts/validate_all.py
```

脚本会检查 SKILL.md frontmatter、站点与小程序文件完整性、JS/Python 语法、两份运行时模板一致性，并实际生成一个 BAT 包验证 ZIP 完整性。

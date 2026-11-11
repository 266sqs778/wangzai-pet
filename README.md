# 灯灯桌宠 · 一整套可上线的桌宠服务

把「宠物照片 → 会动的桌面小伙伴」做成一条完整链路：**复刻官网 → 网页免费定制 → 一键导出免安装桌宠包（BAT / EXE）→ 发布成在线链接 → 微信小程序引流 → 挂到微信公众号 → 沉淀为 skill 包 / GitHub 仓库**。

> 本项目是对 dengdengpet.com 的**开源复刻演示，非官方站点**。展示图片为原站素材，商用前请替换为自有图片与品牌名称。

## 在线地址

**分享链接**：https://dengdeng-pet-07104.app.workbuddy.host/?sharecode=G672SI7TFH

打开后点右上角「免费定制」，选形象或上传自家照片、起名字、加台词，点「免费生成桌宠包」即可下载一个 ZIP。解压双击 `start.bat`，宠物就上桌了。全程在浏览器本机完成，不上传照片。

## 五件交付物

| # | 交付物 | 位置 | 说明 |
|---|---|---|---|
| 1 | 上线网站 | `web/` | 复刻官网 + 免费定制台 + 浏览器内 ZIP 打包 |
| 2 | 免安装桌宠包 | 网页实时生成 | BAT 轻量包（几十 KB）；或下载 EXE 完整版（17 MB） |
| 3 | 微信小程序 | `miniprogram/` | 手机定制、生成链接、公众号挂载指南，无后端 |
| 4 | Skill 包 | `skill/dengdeng-pet/`、`dist/dengdeng-pet.zip` | 符合 Agent Skill 规范，官方校验器 9/9 通过 |
| 5 | 文档 | `docs/`、`miniprogram/README.md` | 部署、包格式、资质与公众号规则 |

## 目录结构

```
web/                     上线静态站点（index.html / app.js / pack.js / runtime.js / export.js / assets/）
  download/              EXE 完整版 zip
miniprogram/             原生微信小程序（config.js 里改线上域名与分享码）
skill/dengdeng-pet/      SKILL.md + scripts/ + references/ + assets/
docs/                    微信公众号与小程序指南
dist/                    dengdeng-pet.zip（可分发的 skill 包）、dengdeng-pet.exe
desktop_pet.py           Python 桌宠（完整控制台版）
server.py                本地控制台服务（127.0.0.1:8765）
build_assets.py          透明精灵图生成
bundle_pet.py            EXE 冻结入口
start.bat                本地控制台一键启动
push_to_github.bat       推送到 GitHub
```

## 快速开始

### 只想直接用

打开上面的在线链接，或双击 `start.bat`（本地控制台版）。

### 想改网站

```bash
cd web
python -m http.server 8766
# 浏览器打开 http://127.0.0.1:8766/
```

改完用发布应用工具重新部署 `web/` 目录（会覆盖同一条分享链接）。

### 想命令行批量生成桌宠包

```bash
python skill/dengdeng-pet/scripts/make_bat_pack.py --name 团子 --species cat --out dist/tuanzi.zip
python skill/dengdeng-pet/scripts/make_bat_pack.py --photo my-cat.jpg --name 咪咪 --out dist/mimi.zip
python skill/dengdeng-pet/scripts/build_exe.py --out web/download/dengdeng-pet-exe.zip
python skill/dengdeng-pet/scripts/validate_all.py
```

### 想装成 skill

把 `dist/dengdeng-pet.zip` 解压到 `~/.workbuddy/skills/dengdeng-pet/`（用户级）或项目的 `.workbuddy/skills/dengdeng-pet/`（团队级）。

### 想跑小程序

用微信开发者工具导入 `miniprogram/`，把 `project.config.json` 的 `appid` 换成自己的，`config.js` 换成自己的线上域名与分享码。详见 `miniprogram/README.md` 与 `docs/微信公众号与小程序指南.md`。

### 想推到 GitHub

双击 `push_to_github.bat`，按提示粘贴仓库地址；或手动：

```bash
git remote add origin https://github.com/<you>/<repo>.git
git branch -M main
git push -u origin main
```

本地仓库已初始化并完成首次提交。

## 关键设计

- **零依赖分发**：BAT 包靠 Windows 自带 PowerShell + WinForms，图片用 `#FF00FF` 透明键；EXE 版由 PyInstaller 编译，读取同目录的 `pet-config.json` 与 `assets/pet/*.png`，因此一个通用 EXE 可配任意定制宠物。
- **无后端**：网站、小程序都不需要服务器、数据库或登录；照片只在浏览器本地处理。
- **分享协议**：定制参数编码在 URL query 里，小程序生成的链接在电脑打开会自动还原（见 `skill/dengdeng-pet/references/URL定制参数.md`）。
- **隐私**：不上传照片、不联网、不埋点；配置只存在本机。

## 资质速记（详细见 docs）

- 公众号可「快速注册并认证小程序」，复用主体与认证资质，免 300 元认证费；企业类每月 5 个、个体户每月 1 个。
- 注册上限按**主体**算：个人身份证 5 个、企业营业执照 50 个、个体户 5 个；与公众号数量、管理员微信数量无关。
- 一个公众号可关联 10 个同主体 + 3 个不同主体小程序；小程序上架前必须完成 ICP 备案。
- 个人主体小程序不能用 `web-view`，所以本项目用「小程序生成链接 → 电脑浏览器打开」的方式绕开限制。

## 验证记录

- 网站：首页、JS、精灵图、17 MB EXE zip 在线均返回 200（需先带分享码访问写入会话 Cookie）。
- 导出包：浏览器生成的 ZIP 通过 `zipfile.testzip()`，PNG 洋红键、ps1 BOM、配置字段正确。
- 实机：BAT 包双击后透明置顶的猫出现在桌面；EXE 版进程与主循环心跳正常。
- 小程序：4 个页面、JSON 严格性、JS 语法、WXML 约束校验通过。
- Skill 包：`validate_all.py` 9/9 通过，官方 `package_skill.py` 校验并打包成功。

## 许可

代码部分按 MIT 使用；`assets/` 下的展示素材来自原站，仅用于演示，商用需替换为自有素材。

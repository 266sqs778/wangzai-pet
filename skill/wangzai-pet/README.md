# 望崽宠乐园 · 一整套可上线的桌宠服务

> 当前版本 **v1.5.0**（2026-11-16：照片桌宠升级为 6 套动作 / 40 帧循环动画，桌宠会自己散步、伸懒腰、舔毛、睡觉、开心跳）。详见 [CHANGELOG.md](CHANGELOG.md)。

把「宠物照片 → 会动的桌面小伙伴」做成一条完整链路：**品牌官网 → 网页免费定制 → 一键导出免安装桌宠包（BAT / EXE）→ 发布成在线链接 → 微信小程序引流 → 挂到微信公众号 → 沉淀为 skill 包 / GitHub 仓库**。

> 本项目为**【望崽宠乐园】独立品牌站点**，由「万界店长 · 模因公社」出品。源码与交互均为自主实现，与任何第三方站点无隶属关系。仓库内 `assets/` 为演示图片，商用前请替换为自有素材。

## 在线地址

**开源仓库**：https://github.com/266sqs778/wangzai-pet

**GitHub Pages（无门禁，可直接甩）**：https://266sqs778.github.io/wangzai-pet/

**微信传播链接（必须完整带 sharecode）**：https://dengdeng-pet-07104.app.workbuddy.host/?sharecode=G672SI7TFH

> ⚠️ 裸域名 `https://dengdeng-pet-07104.app.workbuddy.host/` 会返回 403。发布平台有分享码门禁，**第一次访问必须带 `?sharecode=G672SI7TFH`**。转发时请整条链接一起复制，或直接发 `promo/` 里的宣传海报（扫码自动带参）。
>
> 关于域名：`dengdeng-pet-07104` 是发布平台在首次部署时自动分配的域名标识，与【望崽宠乐园】品牌无关。已发出的海报二维码指向该链接，故暂不更换；绑定自有域名或改用上面的 GitHub Pages 即可完全去除。

打开后点右上角「免费定制」，选形象或上传自家照片、起名字、加台词，点「生成我的专属 EXE 桌宠包」即可下载一个 ZIP。解压后双击 `wangzai-pet.exe`，宠物就上桌了：照片宠物带 6 套动作、40 帧循环动画，会呼吸、散步、伸懒腰、舔毛、睡觉、开心跳，还会自己换姿势并冒出气泡台词；右键可手动点动作，设置面板可调动作节奏。全程在浏览器本机完成，不上传照片。

## 微信传播物料（扫一扫就能用）

`promo/` 下是可以直接发微信群 / 朋友圈 / 公众号图文的成品：

| 文件 | 用途 |
|---|---|
| `望崽宠乐园-微信宣传海报.png` | 1080×1440 竖版主海报，含网站入口码 + 店主微信码 |
| `望崽宠乐园-朋友圈方图.png` | 1080×1080 方图，九宫格友好 |
| `望崽宠乐园-扫码直达.png` | 纯二维码，贴群公告 / 名片 / 图文 |
| `微信分享文案.txt` | 可直接复制的转发话术 + 完整链接 |

所有二维码编码的都是**带 `?sharecode=G672SI7TFH` 的完整链接**，扫码自动带参，
避开平台门禁；已用 zbar 解码器逐张验证可读。以后换了域名，改
`make_promo.py` 里的 `SITE_URL` 再运行 `python make_promo.py` 即可重新生成。

> 传播时链接务必整条复制，末尾参数丢了会 403。最保险的是直接发海报图，
> 或把根目录 `望崽宠乐园-单文件版.html` 当文件转发（零外部请求，双击即用）。

## 五件交付物

| # | 交付物 | 位置 | 说明 |
|---|---|---|---|
| 1 | 上线网站 | `web/` | 品牌官网 + 免费定制台 + 浏览器内 ZIP 打包 |
| 2 | 免安装桌宠包 | 网页实时生成 | BAT 轻量包（几十 KB）；或专属 EXE（17 MB，含照片生成的 40 帧动画） |
| 3 | 微信小程序 | `miniprogram/` | 手机定制、生成链接、公众号挂载指南，无后端 |
| 4 | Skill 包 | `skill/wangzai-pet/`、`dist/wangzai-pet.zip` | 符合 Agent Skill 规范，官方校验器 9/9 通过 |
| 5 | 文档 | `docs/`、`miniprogram/README.md` | 部署、包格式、资质与公众号规则 |

## 目录结构

```
web/                     上线静态站点（index.html / app.js / pack.js / runtime.js / export.js / assets/）
  download/              EXE 完整版 zip
miniprogram/             原生微信小程序（config.js 里改线上域名与分享码）
skill/wangzai-pet/      SKILL.md + scripts/ + references/ + assets/
docs/                    微信公众号与小程序指南
dist/                    wangzai-pet.zip（可分发的 skill 包）、wangzai-pet.exe
desktop_pet.py           Python 桌宠（完整控制台版）
server.py                本地控制台服务（127.0.0.1:8765）
build_assets.py          透明精灵图生成
bundle_pet.py            EXE 冻结入口
start.bat                本地控制台一键启动
make_promo.py            生成微信海报 / 方图 / 入口二维码 / 转发文案
promo/                   现成的微信传播物料（可直接发群发圈）
.github/workflows/       GitHub Pages 自动部署工作流
build_standalone.py      把多文件源码打包成自包含单文件 index.html
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
python skill/wangzai-pet/scripts/make_bat_pack.py --name 团子 --species cat --out dist/tuanzi.zip
python skill/wangzai-pet/scripts/make_bat_pack.py --photo my-cat.jpg --name 咪咪 --out dist/mimi.zip
python skill/wangzai-pet/scripts/build_exe.py --out web/download/wangzai-pet-exe.zip
python skill/wangzai-pet/scripts/validate_all.py
```

### 想装成 skill

把 `dist/wangzai-pet.zip` 解压到 `~/.workbuddy/skills/wangzai-pet/`（用户级）或项目的 `.workbuddy/skills/wangzai-pet/`（团队级）。

### 想跑小程序

用微信开发者工具导入 `miniprogram/`，把 `project.config.json` 的 `appid` 换成自己的，`config.js` 换成自己的线上域名与分享码。详见 `miniprogram/README.md` 与 `docs/微信公众号与小程序指南.md`。

### 仓库与 GitHub Pages

仓库已发布在 **https://github.com/266sqs778/wangzai-pet**（公开、默认分支 `main`）。
`.github/workflows/pages.yml` 会在每次 push 后自动把 `web/` 部署到 GitHub Pages：

https://266sqs778.github.io/wangzai-pet/

这个链接**没有分享码门禁**，可以直接甩、直接做二维码，适合当长期自有入口。
注意国内访问 `github.io` 偶有波动，主力传播仍建议用上面的分享链接、海报二维码，
或直接转发单文件版 HTML。本地同步只需 `git push`（`master` 已跟踪 `origin/main`）。

## 关键设计

- **零依赖分发**：BAT 包靠 Windows 自带 PowerShell + WinForms，图片用 `#FF00FF` 透明键；EXE 版由 PyInstaller 编译，读取同目录的 `pet-config.json` 与 `assets/pet/*.png`。配置里的 `animations` 给出每套动作的帧名与 fps，引擎按帧循环播放；没有帧映射的内置宠物则用 8 相位缓存形变实时动起来。一个通用 EXE 可配任意定制宠物。
- **无后端**：网站、小程序都不需要服务器、数据库或登录；照片只在浏览器本地处理。
- **分享协议**：定制参数编码在 URL query 里，小程序生成的链接在电脑打开会自动还原（见 `skill/wangzai-pet/references/URL定制参数.md`）。
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

代码部分按 MIT 使用；`assets/` 下的演示图片商用前请替换为自有素材。

## 重要：线上站点为什么曾打不开 / 功能全失效

发布平台有一层「分享码门禁」：访客**第一次访问必须带 `?sharecode=G672SI7TFH`**，
服务器才会种下会话 Cookie；此后所有静态资源（CSS / JS / 图片）才放行。
不带码、参数被微信或预览面板丢掉、或 iframe 内 Cookie 受限时，全部资源返回 403
「链接不完整」，表现为页面能开但样式与功能全废、二维码看不到。

因此：
1. **发布入口 `web/index.html` 是自包含单文件** —— CSS、全部 JS、四张二维码、
   展示图与宠物精灵图全部内联为 data URI，零外部请求，门禁只要放行 HTML 就能完整工作。
   可维护的多文件源码在 `web/index-src.html`；改完源码后运行
   `python build_standalone.py` 重新生成 `web/index.html` 与
   根目录 `望崽宠乐园-单文件版.html`。
2. **分享链接必须带门禁码**：`shareUrl()` 与「我的分享码」生成的 URL 都写入了
   `sharecode`；`openConsole()` 清理地址栏时也会保留它。切勿传播裸域名。
3. **离线 / 传播版**：直接把 `望崽宠乐园-单文件版.html` 发给朋友（微信文件、
   双击打开均可），完全不依赖服务器和 Cookie。
4. 页头「◈ 联系 & 二维码」直达四张引流码；控制台与页脚的「我的分享码」
   生成访客专属二维码。

验证：Playwright 真实浏览器下线上与 `file://` 各 8-9 项检查全通过，
包含真正下载 303KB 桌宠包并校验 ZIP 完整性。

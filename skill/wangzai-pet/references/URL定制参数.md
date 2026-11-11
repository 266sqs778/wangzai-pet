# 定制分享链接协议

网页与微信小程序共用同一套 URL query 参数，保证「手机定制 → 电脑打开」无缝还原。

## 参数

| 参数 | 含义 | 示例 |
|---|---|---|
| `sharecode` | 部署平台颁发的分享码，首次访问写入会话 Cookie | `G672SI7TFH` |
| `s` | 形象 key | `cat` / `orange` / `dog` / `rabbit` / `chinchilla` / `hamster` / `bird` |
| `n` | 名字，URL 编码，最长 12 字 | `%E5%9B%A2%E5%AD%90` |
| `z` | 大小 100–420 | `220` |
| `v` | 速度 1–8 | `2` |
| `a` | 自动换动作，1 / 0 | `1` |
| `t` | 窗口置顶，1 / 0 | `1` |
| `l` | 台词表，用 `\|` 分隔并整体 URL 编码 | `%E4%BD%A0%E5%A5%BD%7C%E5%96%9D%E6%B0%B4` |

> 自定义照片**不进链接**（体积太大且涉及隐私）。手机端只定制形象与文字；照片在电脑网页里上传。

## 示例

```
https://<host>/?sharecode=<code>&s=cat&n=%E5%9B%A2%E5%AD%90&z=240&v=3&a=1&t=1&l=%E4%BD%A0%E5%A5%BD%E5%91%80%7C%E8%AF%A5%E5%96%9D%E6%B0%B4%E5%95%A6
```

## 网页端还原

`app.js` 的 `restoreFromUrl()` 用 `URLSearchParams` 读取参数，做范围夹取与缺省回退：

- 未知 `s` → `cat`；空名字 → `望崽`；
- `z` 夹到 100–420，`v` 夹到 1–8；
- `a` / `t` 只有显式 `0` 才关闭；
- `l` 按 `|` 切分，最多 12 条；
- 检测到 `s` 参数即自动展开定制台，并用 `history.replaceState` 抹掉 query，避免刷新重复提示。

## 小程序端生成

`miniprogram/config.js` 的 `buildShareUrl(cfg)` 按同样顺序拼接；`preview` 页调用 `wx.setClipboardData` 复制，用户发给「文件传输助手」后在电脑浏览器打开。

更换部署域名时只改 `config.js` 顶部的 `SITE_BASE` 与 `SHARE_CODE`。

## 为什么不用 base64 / 短链

- 小程序环境没有 `btoa`，手写 base64 容易在中文上出错；
- 无需后端就没有地方存短链映射；
- query 参数可直接肉眼校验、可手改，调试成本低，也方便公众号菜单里带固定参数。

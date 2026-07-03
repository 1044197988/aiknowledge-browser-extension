# 📚 灏天文库剪藏助手 - Chrome Extension

一键收藏网页内容到[灏天文库](https://aiknowledge.cn)个人花园文集。

![版本](https://img.shields.io/badge/版本-1.1.0-blue)
![Manifest](https://img.shields.io/badge/Manifest-V3-green)
![License](https://img.shields.io/badge/许可-MIT-orange)

## ✨ 功能特性

- 🚀 **一键收藏** — 右键菜单 / 快捷键 `Alt+S` / 弹窗按钮
- 📋 **智能提取** — 自动识别网页正文（博客、新闻、微信等）
- 📁 **文集管理** — 选择个人花园文集，自动记住上次选择
- ✏️ **内容编辑** — 收藏前可预览和编辑
- 🔔 **收藏反馈** — 成功/失败通知，显示文档 ID
- 🔒 **Token 认证** — 相同的个人 API Token

## 📦 安装

### 前提条件

1. 已获取个人 **API Token**
2. Chrome 或基于 Chromium 的浏览器

### 安装扩展

1. 打开 `chrome://extensions/`
2. 开启 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择本目录 `aiknowledge-browser-extension/`

## ⚙️ 配置

1. 点击工具栏扩展图标 → **设置**
2. **API 服务器地址**：默认 `https://zzht.tech`
3. **个人 API Token**：粘贴 Token
4. 点击 **测试连接**（会检查服务健康 + Token 是否有效）
5. 点击 **保存设置**

> 请填入正确 Token，服务器地址默认 `https://zzht.tech`。

## 🚀 使用方式

### 弹窗收藏

1. 点击扩展图标
2. 选择目标文集，必要时点击「提取内容」
3. 点击「收藏到灏天文库」

### 右键 / 快捷键

- 网页右键 →「收藏到灏天文库」
- 或按 `Alt+S` — 自动收藏到上次使用的文集

## 🏗️ 项目结构

```
aiknowledge-browser-extension/
├── manifest.json
├── background.js         # Service Worker（右键、快捷键）
├── content.js            # 页面内容提取
├── popup.html / popup.js / popup.css
├── shared/
│   ├── api.js            # 与 server REST API 通信
│   └── extract.js        # 注入页面的提取函数
├── icons/
└── README.md
```

## ⚠️ 注意事项

- 仅操作**个人花园文集**
- 创建文档受**用量限制**与**文本敏感词审核**约束
- 文档作者自动设为「用户名的小龙虾」

## 📄 License

MIT License

---

**灏天文库** — [aiknowledge.cn](https://aiknowledge.cn)

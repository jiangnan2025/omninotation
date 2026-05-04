# OmniNotation

<p align="center">
  <img src="assets/icon.png" width="96" alt="OmniNotation Logo">
</p>

<p align="center">
  <b>Universal Web Page Annotation & Rewrite System</b>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#development">Development</a>
</p>

---

**English** | [中文](#中文介绍)

## Overview

OmniNotation is a Chrome browser extension that turns any web page into an annotatable canvas. Using Chrome's native Side Panel, it provides a seamless annotation experience without injecting intrusive UI elements into the page.

Key highlights:
- 📝 **Native Side Panel** — No broken shadow DOM sidebars, uses Chrome's official `sidePanel` API
- 🎯 **Persistent Text Highlights** — Anchors selections using `dom-anchor-text-quote` for robust text quote resolution across page reloads
- 🔄 **Bidirectional Navigation** — Click a highlight to jump to its annotation, click an annotation to scroll to its highlight
- 🎨 **Customizable Highlight Colors** — Yellow, blue, green, red, purple, orange
- 📌 **Bookmark Pages** — Quick bookmark with visual indicator on the extension icon
- 💬 **Markdown Comments & Replies** — Full Markdown support with collapsible reply threads
- 🧭 **SPA-Aware** — Automatically re-renders highlights on dynamic SPA navigation

## Features

| Feature | Description |
|---------|-------------|
| **Text Highlighting** | Select any text on a page and add an annotation. Highlights persist across reloads using text-quote anchoring. |
| **Side Panel UI** | Chrome native side panel showing all annotations for the current page with Markdown rendering. |
| **Drag & Drop Sorting** | Annotations are sorted by their position on the page by default. Users can drag to reorder. |
| **Bidirectional Scroll** | Click highlighted text → side panel scrolls to card. Click card → page scrolls to highlight. |
| **Color Picker** | Choose your preferred highlight color (default yellow). Broadcasts to all tabs instantly. |
| **Bookmarks** | Toggle bookmark with star icon. Extension icon changes color (gold = bookmarked, green = not). |
| **Context Menu** | Right-click selected text to save it as an annotation. |
| **SPA Support** | MutationObserver with debouncing detects dynamic content changes and re-renders highlights. |

## Installation

### From Chrome Web Store

> _Coming soon — the extension is currently in development._

### Developer Mode (Local Install)

1. Clone this repository:
   ```bash
   git clone https://github.com/jiangnan2025/omninotation.git
   cd omninotation
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   pnpm install
   ```

3. Build the extension:
   ```bash
   npm run build
   # or
   pnpm build
   ```

4. Open Chrome and navigate to `chrome://extensions/`

5. Enable **Developer mode** (toggle in the top right)

6. Click **Load unpacked** and select the `build/chrome-mv3-prod` folder

7. The extension icon should appear in your toolbar. Click it to open the Side Panel.

## Usage

### Adding an Annotation

1. **Via text selection**: Select text on any page → a floating action menu appears → type your comment → save.
2. **Via context menu**: Select text → right-click → choose "Send to OmniNotation".
3. **Via side panel**: Open the side panel → click "+ Add Annotation" to add a page-level note without text selection.

### Managing Annotations

- **Scroll to highlight**: Click any annotation card in the side panel to smoothly scroll to the corresponding highlighted text on the page.
- **Click highlight**: Click any highlighted text (`<mark>`) on the page to scroll its annotation card into view in the side panel.
- **Reply**: Click the 💬 button under any annotation to add a reply.
- **Reorder**: Drag and drop annotation cards in the side panel to customize their order. Click "Reset to Page Order" to restore default sorting.

### Customization

- **Highlight Color**: Use the color picker in the side panel header to change the highlight color for all tabs.
- **Bookmark**: Click the star icon in the side panel header to bookmark/unbookmark the current page.

## Development

```bash
# Start development server with hot reload
npm run dev
# or
pnpm dev

# Build for production
npm run build
# or
pnpm build

# Package as a zip for distribution
npm run package
# or
pnpm package
```

> **Dev Caveat**: The extension auto-reloads on save when using `plasmo dev`. Open pages must be refreshed for the content script to be reinjected. If you see "Extension context invalidated", refresh the page.

## Project Structure

```
omninotation/
├── src/
│   ├── background/          # Service worker
│   │   └── index.ts         # Context menu, icon tinting, side panel open
│   ├── contents/
│   │   └── omninotation.tsx # Content script: highlight injection, SPA observer
│   ├── components/
│   │   ├── ActionMenu.tsx   # Floating toolbar on text selection
│   │   └── SidebarContainer.tsx # Legacy sidebar container
│   ├── services/
│   │   ├── storage.ts       # Chrome storage abstraction (annotations, bookmarks, colors, order)
│   │   ├── anchor.ts        # dom-anchor-text-quote wrapper
│   │   └── config.ts        # Domain-specific config
│   ├── types/
│   │   └── index.ts         # TypeScript interfaces
│   ├── sidepanel.tsx        # Chrome native side panel UI
│   └── style.css            # Tailwind + custom styles
├── assets/
│   └── icon.png             # Extension icon
├── build/                   # Build output
└── package.json
```

## Tech Stack

- [Plasmo](https://www.plasmo.com/) — Browser extension framework
- [React 18](https://react.dev/) — UI library
- [TypeScript](https://www.typescriptlang.org/) — Type safety
- [Tailwind CSS](https://tailwindcss.com/) — Utility-first CSS
- [marked](https://marked.js.org/) — Markdown rendering
- [dom-anchor-text-quote](https://github.com/tilgovi/dom-anchor-text-quote) — Robust text anchoring

## CI/CD

This project includes a GitHub Actions workflow (`.github/workflows/submit.yml`) for automated submission to the Chrome Web Store via [Browser Platform Publish](https://bpp.browser.market/).

To use it:
1. First manually upload the extension to the Chrome Web Store to establish credentials
2. Add your `SUBMIT_KEYS` secret to the repository
3. Trigger the workflow manually

## License

MIT License © OmniNotation Team

---

<a name="中文介绍"></a>

## 中文介绍

OmniNotation 是一款 Chrome 浏览器扩展，将任意网页变成可批注的画布。它使用 Chrome 原生 Side Panel，提供不侵入页面的无缝批注体验。

### 核心功能

| 功能 | 说明 |
|------|------|
| **文本高亮** | 选中任意文本即可添加批注，使用文本引索技术持久化，刷新后仍可恢复 |
| **原生侧边栏** | 使用 Chrome 官方 `sidePanel` API，不再依赖易出问题的 Shadow DOM 注入方案 |
| **双向导航** | 点击批注卡片 → 页面滚动到高亮处；点击高亮 → 侧边栏滚动到对应卡片 |
| **拖拽排序** | 默认按文本在页面中的出现位置排序，也支持手动拖拽自定义顺序 |
| **颜色自定义** | 6 种高亮颜色可选（黄/蓝/绿/红/紫/橙），实时同步到所有标签页 |
| **书签收藏** | 一键收藏页面，扩展图标变色提示（金色=已收藏，绿色=未收藏） |
| **Markdown 支持** | 批注和回复均支持完整 Markdown 渲染 |
| **SPA 适配** | 自动检测单页应用导航和动态内容变化，自动重新渲染高亮 |

### 快速开始

```bash
git clone https://github.com/jiangnan2025/omninotation.git
cd omninotation
npm install
npm run build
```

然后在 Chrome 中加载 `build/chrome-mv3-prod` 目录。

### 使用说明

**添加批注**：
- 选中网页文字 → 浮动菜单输入批注 → 保存
- 或右键选中文字 → "发送到 OmniNotation"
- 或在侧边栏点击 "+ 添加批注" 添加页面级笔记

**管理批注**：
- 点击侧边栏中的批注卡片 → 页面自动滚动到对应高亮文字
- 点击页面上的高亮文字 → 侧边栏自动滚动到对应卡片
- 拖拽卡片可自定义排序，点击"重置为页面顺序"恢复默认

### 技术栈

Plasmo + React 18 + TypeScript + Tailwind CSS + marked + dom-anchor-text-quote

# OmniNotation

<p align="center">
  <img src="assets/icon.png" width="96" alt="OmniNotation Logo">
</p>

<p align="center">
  <b>Universal Web Page Annotation & Bookmark Manager</b>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#development">Development</a> •
  <a href="#changelog">Changelog</a>
</p>

---

**English** | [中文](#中文介绍)

> **Latest Update** — See what's new in the [Changelog](#changelog).


## Overview

OmniNotation is a Chrome browser extension that turns any web page into an annotatable canvas with a powerful bookmark manager. Using Chrome's native Side Panel, it provides a seamless annotation experience without injecting intrusive UI elements into the page.

Key highlights:
- 📝 **Native Side Panel** — Uses Chrome's official `sidePanel` API for a first-class experience
- 🎯 **Persistent Text Highlights** — Anchors selections using `dom-anchor-text-quote` for robust text quote resolution across page reloads
- 🔄 **Bidirectional Navigation** — Click a highlight to open the side panel & jump to its annotation; click an annotation card to scroll to its highlight
- 🎨 **4 Highlight Styles** — Highlight, underline, strikethrough, and squiggly underline
- 📁 **Nested Bookmark Folders** — Multi-level folder organization for your annotated pages
- 🔖 **Auto-Bookmark** — Pages with annotations are automatically bookmarked
- 🏷️ **Page-Level Tags & Visibility** — Tag and control access per page, not per annotation
- 💬 **Hierarchical Replies** — Nested comment threads with full Markdown + KaTeX support
- 🧭 **SPA-Aware** — Automatically re-renders highlights on dynamic SPA navigation

## Features

| Feature | Description |
|---------|-------------|
| **Text Highlighting** | Select any text and annotate with 4 mark styles. Highlights persist across reloads using text-quote anchoring. |
| **Context Menu** | Right-click selected text to instantly highlight with your preferred style (highlight / underline / strikethrough / squiggly). |
| **Sticky Notes** | Place sticky notes anywhere on the page with a single click. |
| **Side Panel UI** | Chrome native side panel showing all annotations for the current page with Markdown & KaTeX rendering. |
| **Click Highlight → Open Panel** | Click any mark on the page to automatically open the side panel and scroll to the corresponding annotation. |
| **Drag & Drop Sorting** | Annotations sorted by page Y-position by default. Drag to reorder manually. Reset anytime. |
| **Nested Replies** | Reply to any comment, and reply to replies — fully hierarchical thread support. |
| **Color Picker** | 6 highlight colors (yellow/blue/green/red/purple/orange). Broadcasts to all tabs instantly. |
| **Page-Level Permissions** | Set visibility per page: 🔒 Private, 🌐 Public, or 👥 Group. Group management built-in. |
| **Page Tags** | Add tags to bookmarked pages for quick categorization and filtering. |
| **Bookmark Folders** | Organize bookmarked pages into nested folders via the Options dashboard. |
| **Global Search** | Search across all annotations, quotes, replies, and tags from the bookmark dashboard. |
| **SPA Support** | MutationObserver with smart re-rendering — only re-renders when highlight count mismatch is detected. |
| **Selection Toolbar** | Select text on any page to pop up a floating toolbar with annotate, comment, and multi-engine search options. |
| **Multi-Engine Search** | Search selected text via Google, Bing, Baidu, DuckDuckGo, GitHub, Wikipedia, and more. Supports custom search engine list and new-tab control. |
| **Copy Link Name** | Right-click a hyperlink to copy its display text via the "Copy Link Name" context menu. |
| **Quick Delete Annotations** | Delete all highlights on the current page with a single action from the side panel. |
| **Export / Import** | Backup and restore all your data as JSON. |

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

1. **Via context menu**: Select text → right-click → choose a mark style (▌ Highlight / U̲ Underline / S̶ Strikethrough / 〰 Squiggly). The side panel will open automatically.
2. **Via sticky note**: Click the "📌 Sticky" button in the side panel → click anywhere on the page to place a note.
3. **Via side panel**: Click "+ Add Annotation" to add a page-level note without text selection.

### Managing Annotations

- **Scroll to highlight**: Click any annotation card in the side panel to smoothly scroll to the corresponding text on the page.
- **Click highlight**: Click any highlighted text (`<mark>`) on the page to automatically open the side panel and scroll its card into view.
- **Reply**: Click 💬 under any annotation to add a reply. Reply to replies for nested threads.
- **Edit**: Click "Edit" on any annotation or reply to modify its content.
- **Status**: Toggle "✓ Resolved" to mark an annotation as done.
- **Reorder**: Drag and drop cards to customize order. Click "Reset to Page Order" to restore default sorting.

### Permissions & Tags

- **Page Visibility**: Use the "Page Permission" selector in the side panel to set the whole page as 🔒 Private, 🌐 Public, or 👥 Group.
- **Groups**: Expand the "Group Manager" section in the side panel to create/delete groups.
- **Page Tags**: Click "＋ Tag" in the side panel header to add tags to the current page.

### Bookmark Dashboard

Click the 📊 button in the side panel header (or go to `chrome://extensions` → OmniNotation → Extension options) to open the Bookmark Manager:

- **Nested Folders**: Create multi-level folders to organize your bookmarked pages.
- **Move to Folder**: Use the dropdown on each bookmark to move it between folders.
- **Global Search**: Search across all annotations, quotes, replies, and tags.
- **Tag Filter**: Click tag badges to filter bookmarks by tag.
- **Jump**: Click "Jump" on any annotation to open the page and auto-scroll to the highlight.

### Backup

In the side panel footer, click "📤 Export" to download a JSON backup of all your data, or "📥 Import" to restore from a backup file.

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
│   ├── background/
│   │   └── index.ts              # Service worker: context menu, icon tinting, side panel open
│   ├── contents/
│   │   └── omninotation.tsx      # Content script: highlight injection, SPA observer, sticky notes
│   ├── components/
│   │   ├── AnnotationCard.tsx    # Single annotation card (side panel)
│   │   ├── MarkdownContent.tsx   # Markdown + KaTeX renderer
│   │   ├── ReplyThread.tsx       # Nested reply thread component
│   │   ├── GroupManager.tsx      # Group management panel
│   │   ├── SelectionToolbar.tsx  # Floating toolbar on text selection (annotate / search)
│   │   └── ActionMenu.tsx        # Legacy floating toolbar (unused)
│   ├── services/
│   │   ├── storage.ts            # Chrome storage abstraction
│   │   ├── anchor.ts             # dom-anchor-text-quote wrapper
│   │   ├── highlights.ts         # DOM highlight rendering & lifecycle
│   │   └── config.ts             # Domain-specific config
│   ├── types/
│   │   └── index.ts              # TypeScript interfaces
│   ├── sidepanel.tsx             # Chrome native side panel UI
│   ├── options.tsx               # Bookmark manager / dashboard
│   └── style.css                 # Tailwind + custom styles
├── assets/
│   └── icon.png                  # Extension icon
├── build/                        # Build output
└── package.json
```

## Tech Stack

- [Plasmo](https://www.plasmo.com/) — Browser extension framework
- [React 18](https://react.dev/) — UI library
- [TypeScript](https://www.typescriptlang.org/) — Type safety
- [Tailwind CSS](https://tailwindcss.com/) — Utility-first CSS
- [marked](https://marked.js.org/) — Markdown rendering
- [KaTeX](https://katex.org/) — Math formula rendering
- [dom-anchor-text-quote](https://github.com/tilgovi/dom-anchor-text-quote) — Robust text anchoring

## License

MIT License © OmniNotation Team

---

<a name="中文介绍"></a>

## 中文介绍

OmniNotation 是一款 Chrome 浏览器扩展，将任意网页变成可批注的画布，并内置多级文件夹收藏夹管理器。它使用 Chrome 原生 Side Panel，提供不侵入页面的无缝批注体验。

### 核心功能

| 功能 | 说明 |
|------|------|
| **文本高亮** | 选中任意文本即可添加批注，支持 4 种标记样式。使用文本锚索技术持久化，刷新后仍可恢复 |
| **右键菜单** | 右键选中文字，直接选择高亮/下划线/删除线/波浪线样式保存 |
| **便签** | 点击侧边栏"📌 便签"按钮，再在页面任意位置单击即可放置便签 |
| **原生侧边栏** | 使用 Chrome 官方 `sidePanel` API |
| **点击高亮打开侧边栏** | 点击页面上的高亮标记，自动打开侧边栏并定位到对应批注 |
| **双向导航** | 点击批注卡片 → 页面滚动到高亮处；点击高亮 → 侧边栏打开并定位 |
| **层级回复** | 支持评论嵌套，可回复任意层级的评论 |
| **拖拽排序** | 默认按文本在页面中的出现位置排序，也支持手动拖拽自定义顺序 |
| **4 种标记样式** | 高亮、下划线、删除线、波浪线 |
| **6 种高亮颜色** | 黄/蓝/绿/红/紫/橙，实时同步到所有标签页 |
| **页面级权限** | 🔒 仅自己 / 🌐 公开 / 👥 群组，整页统一设置 |
| **群组管理** | 侧边栏内可创建、删除群组 |
| **页面标签** | 为收藏页面添加标签，便于分类检索 |
| **多级收藏夹** | 在选项页中用文件夹组织收藏页面，支持无限嵌套 |
| **全局搜索** | 在收藏夹中跨页面搜索批注内容、引用、回复和标签 |
| **导出/导入** | JSON 格式备份与恢复全部数据 |
| **SPA 适配** | 智能检测单页应用导航，仅在必要时重新渲染高亮 |

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
- 选中网页文字 → 右键选择标记样式 → 自动保存并打开侧边栏
- 或点击侧边栏"📌 便签" → 在页面任意位置单击放置
- 或在侧边栏点击 "+ 添加批注" 添加页面级笔记

**管理批注**：
- 点击侧边栏中的批注卡片 → 页面自动滚动到对应高亮文字
- 点击页面上的高亮/下划线等标记 → 自动打开侧边栏并定位到该批注
- 点击 💬 可添加评论，支持回复嵌套评论
- 拖拽卡片可自定义排序，点击"重置为页面顺序"恢复默认

**权限与标签**：
- 在侧边栏"页面权限"中选择整页的可见性：🔒 仅自己 / 🌐 公开 / 👥 群组
- 展开"群组管理"可创建、删除群组
- 点击"＋ 标签"为当前页面添加标签

**收藏夹仪表盘**：
- 点击侧边栏 📊 按钮打开收藏夹管理器
- 左侧可创建多级文件夹，右侧可将收藏移动到指定文件夹
- 支持按标签、关键词、可见性筛选
- 点击批注的"跳转"可打开网页并自动滚动到对应位置

**备份**：
- 侧边栏底部点击"📤 导出"下载 JSON 备份，"📥 导入"恢复数据

### 技术栈

Plasmo + React 18 + TypeScript + Tailwind CSS + marked + KaTeX + dom-anchor-text-quote

---

<a name="changelog"></a>

## Changelog

###  — 浮动工具栏 & 标注 / 搜索增强

- **SelectionToolbar（浮动工具栏）**：选中文字后弹出工具栏，提供标注、批注及多引擎搜索入口。
  - 支持自定义搜索引擎列表与排序。
  - 支持搜索引擎触发条件（黑白名单域名匹配）。
  - 支持在新标签页或当前标签页打开搜索结果。
  - 图标横排整齐排列，支持自定义图标。
  - 支持消失延迟与鼠标悬停保持显示。
- **Copy Link Name**：右键超链接时新增「Copy Link Name」选项，一键复制链接文字。
- **Quick Delete Annotations**：支持快捷删除当前页面全部标注。
- **Multi-Engine Search**：内置 Google / Bing 等搜索引擎，可自行扩展。

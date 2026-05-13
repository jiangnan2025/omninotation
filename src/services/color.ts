// ========================
// Color utilities for annotations & UI
// ========================

export const DEFAULT_ANNOTATION_COLOR = "rgba(250, 204, 21, 0.3)"

export const COLOR_PRESETS = [
  { c: "rgba(250, 204, 21, 0.3)", cls: "bg-yellow-400" },
  { c: "rgba(59, 130, 246, 0.3)", cls: "bg-blue-400" },
  { c: "rgba(34, 197, 94, 0.3)", cls: "bg-green-400" },
  { c: "rgba(239, 68, 68, 0.3)", cls: "bg-red-400" },
  { c: "rgba(168, 85, 247, 0.3)", cls: "bg-purple-400" },
  { c: "rgba(249, 115, 22, 0.3)", cls: "bg-orange-400" }
]

export function hexToRgba(hex: string, alpha: number = 0.3): string {
  const clean = hex.replace("#", "")
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function isPresetColor(color: string): boolean {
  return COLOR_PRESETS.some((p) => p.c === color)
}

// ========================
// Dark mode adaptation
// ========================

export function isDarkMode(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false
}

/**
 * Darken a color for dark mode by reducing its alpha channel.
 * e.g. rgba(250, 204, 21, 0.3) → rgba(250, 204, 21, 0.15)
 */
export function darkenForDarkMode(rgba: string): string {
  return rgba.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/, (_, r, g, b, a) => {
    const alpha = parseFloat(a)
    return `rgba(${r}, ${g}, ${b}, ${Math.max(alpha * 0.5, 0.06)})`
  })
}

// ========================
// Engine icon mapping
// ========================

export const LOCAL_ICON_MAP: Record<string, string> = {
  // 自定义映射：引擎 id -> 图标文件名（不含扩展名）
  "google": "google",
  "bing": "bing",
  "natanalysis": "natanalysis",
  "wikipedia": "wikipedia-en",
  "wikipedia-zh": "wikipedia-zh",
  "youdao": "youdao",
  "zdic": "zdic",
  "google-scholar": "google",
  "pubmed": "pubmed"
}

export function getLocalIconUrl(engineId: string): string {
  const fileName = LOCAL_ICON_MAP[engineId] || engineId
  return chrome.runtime.getURL(`icons/${fileName}.ico`)
}

// Background service worker for OmniNotation

import * as storage from "@/services/storage"

function setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "omninotation-send-to-note",
      title: "发送到 OmniNotation",
      contexts: ["selection"]
    })
  })
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("[OmniNotation] Extension installed")
  setupContextMenu()
})

// Re-register on startup (also covers dev reloads where onInstalled doesn't fire)
setupContextMenu()

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "omninotation-send-to-note" && tab?.id && info.selectionText) {
    chrome.tabs.sendMessage(tab.id, {
      type: "CONTEXT_MENU_SAVE",
      text: info.selectionText
    }).catch(() => {
      // Content script may not be injected yet
    })
  }
})

// Listen for tab updates to notify content scripts about URL changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    chrome.tabs.sendMessage(tabId, {
      type: "TAB_UPDATED",
      url: tab.url
    }).catch(() => {
      // Content script may not be injected yet
    })
  }
})

// Click extension icon to open Chrome side panel
chrome.action.onClicked.addListener((tab) => {
  if (tab.windowId) {
    chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {})
  }
})

// ===== Icon color: red = bookmarked, green = not bookmarked =====

async function createTintedIcon(color: string): Promise<ImageData> {
  const size = 32
  const canvas = new OffscreenCanvas(size, size)
  const ctx = canvas.getContext("2d")!

  // Try to load the original icon from manifest and tint it
  try {
    const manifest = chrome.runtime.getManifest()
    const iconPath = manifest.icons?.[32] || manifest.action?.default_icon?.[32]
    if (!iconPath) throw new Error("No icon found in manifest")

    const response = await fetch(chrome.runtime.getURL("/" + iconPath))
    const blob = await response.blob()
    const bitmap = await createImageBitmap(blob)

    // Draw original
    ctx.drawImage(bitmap, 0, 0, size, size)

    // Apply color tint using source-atop
    ctx.globalCompositeOperation = "source-atop"
    ctx.fillStyle = color
    ctx.fillRect(0, 0, size, size)

    return ctx.getImageData(0, 0, size, size)
  } catch {
    // Fallback: draw a simple colored circle
    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
    ctx.fill()

    // White border
    ctx.strokeStyle = "#ffffff"
    ctx.lineWidth = 2
    ctx.stroke()

    return ctx.getImageData(0, 0, size, size)
  }
}

const GOLD = "#fbbf24"
const GREEN = "#22c55e"

let goldIcon: ImageData | null = null
let greenIcon: ImageData | null = null

async function ensureIcons() {
  if (!goldIcon) goldIcon = await createTintedIcon(GOLD)
  if (!greenIcon) greenIcon = await createTintedIcon(GREEN)
}

async function updateActionIcon(tabId: number, url: string | undefined) {
  if (!url || url.startsWith("chrome://") || url.startsWith("chrome-extension://")) {
    // Reset to default for internal pages
    chrome.action.setIcon({ tabId, path: { 32: "/icon32.plasmo.76b92899.png" } })
    chrome.action.setBadgeText({ tabId, text: "" })
    return
  }

  await ensureIcons()
  const isBookmarked = await storage.isBookmarked(url)
  const icon = isBookmarked ? goldIcon : greenIcon

  if (icon) {
    chrome.action.setIcon({ tabId, imageData: { 32: icon } })
  }

  // Also set a small badge indicator for extra clarity
  if (isBookmarked) {
    chrome.action.setBadgeBackgroundColor({ tabId, color: GOLD })
    chrome.action.setBadgeText({ tabId, text: "★" })
  } else {
    chrome.action.setBadgeText({ tabId, text: "" })
  }
}

// Update icon when tab is activated
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId)
  if (tab?.url) {
    updateActionIcon(tabId, tab.url)
  }
})

// Update icon when tab URL changes
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.url) {
    updateActionIcon(tabId, tab.url)
  }
})

// Update icon when bookmarks change in storage
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local") return
  if (!changes["bookmarks"]) return

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab?.id && tab?.url) {
    updateActionIcon(tab.id, tab.url)
  }
})

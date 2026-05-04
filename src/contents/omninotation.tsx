import type { PlasmoCSConfig } from "plasmo"
import { useCallback, useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import cssText from "data-text:~/style.css"

import { ActionMenu } from "@/components/ActionMenu"
import { SidebarContainer } from "@/components/SidebarContainer"
import * as anchor from "@/services/anchor"
import { getDomainConfig, shouldActivate } from "@/services/config"
import { getKey, saveAnnotation } from "@/services/storage"
import type { Annotation } from "@/types"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"]
}

export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

export const getShadowHostId = () => "omninotation-host"

export const getRootContainer = () => {
  const container = document.createElement("div")
  container.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;overflow:visible;z-index:2147483647;"
  return container
}



// ========================
// Highlight helpers (operate on host DOM)
// ========================

const HIGHLIGHT_CLASS = "omninotation-highlight"
const PAGE_STYLE_ID = "omninotation-page-style"

async function injectPageStyles() {
  const color = await storage.getHighlightColor()
  let style = document.getElementById(PAGE_STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement("style")
    style.id = PAGE_STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = `
    .${HIGHLIGHT_CLASS} {
      cursor: pointer;
      background-color: ${color.bg} !important;
    }
    .${HIGHLIGHT_CLASS}:hover {
      background-color: ${color.hover} !important;
    }
    @keyframes omninotation-flash {
      0% { outline: 2px solid transparent; }
      50% { outline: 2px solid #3b82f6; }
      100% { outline: 2px solid transparent; }
    }
    .${HIGHLIGHT_CLASS}.omninotation-active {
      animation: omninotation-flash 1.2s ease;
    }
  `
}

function clearHighlights() {
  const marks = document.querySelectorAll<HTMLElement>(`mark.${HIGHLIGHT_CLASS}`)
  marks.forEach((el) => {
    const parent = el.parentNode
    if (!parent) return
    while (el.firstChild) {
      parent.insertBefore(el.firstChild, el)
    }
    parent.removeChild(el)
    parent.normalize()
  })
}

function wrapRange(range: Range, id: string, type: "comment" | "edit") {
  const mark = document.createElement("mark")
  mark.className = HIGHLIGHT_CLASS
  mark.dataset.omninotationId = id
  mark.dataset.omninotationType = type

  // First try surroundContents - safest when range is within a single block
  try {
    range.surroundContents(mark)
    attachMarkClick(mark, id)
    return
  } catch {
    // Range spans block boundaries - fall through to text-node splitting
  }

  // Fallback: split by text nodes to avoid wrapping block-level elements
  const textNodes: { node: Text; start: number; end: number }[] = []
  const walker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
    null,
    false
  )

  let node: Node | null
  while ((node = walker.nextNode())) {
    const textNode = node as Text
    const text = textNode.textContent || ""

    let start = 0
    let end = text.length

    if (textNode === range.startContainer) {
      start = range.startOffset
    }
    if (textNode === range.endContainer) {
      end = range.endOffset
    }

    // Check if this text node intersects the range
    const nodeRange = document.createRange()
    nodeRange.selectNode(textNode)

    const isAfterStart = range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0 ||
      (range.startContainer === textNode && range.startOffset < text.length)
    const isBeforeEnd = range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0 ||
      (range.endContainer === textNode && range.endOffset > 0)

    if (isAfterStart && isBeforeEnd && start < end) {
      textNodes.push({ node: textNode, start, end })
    }
  }

  // Process in reverse order so replacements don't shift later indices
  textNodes.reverse().forEach(({ node, start, end }) => {
    const text = node.textContent || ""
    const before = text.slice(0, start)
    const selected = text.slice(start, end)
    const after = text.slice(end)

    if (!selected) return

    const fragment = document.createDocumentFragment()
    if (before) {
      fragment.appendChild(document.createTextNode(before))
    }

    const nodeMark = document.createElement("mark")
    nodeMark.className = HIGHLIGHT_CLASS
    nodeMark.dataset.omninotationId = id
    nodeMark.dataset.omninotationType = type
    nodeMark.textContent = selected
    fragment.appendChild(nodeMark)

    if (after) {
      fragment.appendChild(document.createTextNode(after))
    }

    node.parentNode?.replaceChild(fragment, node)
    attachMarkClick(nodeMark, id)
  })
}

function attachMarkClick(mark: HTMLElement, id: string) {
  mark.addEventListener("click", (e) => {
    e.preventDefault()
    e.stopPropagation()
    chrome.runtime.sendMessage({
      type: "HIGHLIGHT_CLICKED",
      annotationId: id
    }).catch(() => {})
  })
}

function observeSpaNavigation(callback: () => void) {
  let lastUrl = location.href
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href
      callback()
    }
  })
  observer.observe(document.documentElement, { subtree: true, childList: true })
  window.addEventListener("popstate", callback)
  window.addEventListener("hashchange", callback)
  return () => {
    observer.disconnect()
    window.removeEventListener("popstate", callback)
    window.removeEventListener("hashchange", callback)
  }
}

// ========================
// Component
// ========================

export default function OmniNotationOverlay() {
  const [url, setUrl] = useState(location.href)
  const isRendering = useRef(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const renderAnnotations = useCallback((targetUrl: string) => {
    isRendering.current = true
    injectPageStyles().catch(() => {})
    clearHighlights()

    if (!shouldActivate(targetUrl)) {
      isRendering.current = false
      return
    }

    const key = getKey(targetUrl)

    try {
      chrome.storage.local.get([key], (result) => {
        isRendering.current = false

        if (chrome.runtime.lastError) {
          console.warn("[OmniNotation] 扩展已重新加载，请刷新页面以继续使用。")
          return
        }

        const annotations: Annotation[] = result[key] ?? []
        if (annotations.length === 0) return

        const config = getDomainConfig(targetUrl)
        const root = anchor.getRootElement(config.rootSelector)

        for (const ann of annotations) {
          if (!ann.selector) continue
          const range = anchor.resolveRange(root, ann.selector)
          if (range) {
            try {
              wrapRange(range, ann.id, ann.data.type)
            } catch (e) {
              console.warn("[OmniNotation] Failed to wrap highlight:", e)
            }
          }
        }
      })
    } catch (e: any) {
      isRendering.current = false
      if (e?.message?.includes("Extension context invalidated")) {
        console.warn("[OmniNotation] 扩展已重新加载，请刷新页面以继续使用。")
      } else {
        console.warn("[OmniNotation] Render error:", e)
      }
    }
  }, [])

  // Inject host page styles once
  useEffect(() => {
    injectPageStyles()
  }, [])

  // Render highlights when URL changes
  useEffect(() => {
    renderAnnotations(url)
  }, [url, renderAnnotations])

  // SPA navigation detection + MutationObserver for dynamic content
  useEffect(() => {
    const handleNav = () => {
      setUrl(location.href)
    }

    const disposeNav = observeSpaNavigation(handleNav)

    const observer = new MutationObserver((mutations) => {
      if (isRendering.current) return
      const hasExternalChange = mutations.some((m) => {
        const target = m.target as HTMLElement
        if (target.closest?.(`mark.${HIGHLIGHT_CLASS}`)) return false
        for (let i = 0; i < m.addedNodes.length; i++) {
          const node = m.addedNodes[i]
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement
            if (el.classList?.contains(HIGHLIGHT_CLASS)) continue
            if (el.id === PAGE_STYLE_ID) continue
            return true
          }
          if (node.nodeType === Node.TEXT_NODE) return true
        }
        for (let i = 0; i < m.removedNodes.length; i++) {
          const node = m.removedNodes[i]
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement
            if (el.classList?.contains(HIGHLIGHT_CLASS)) continue
            return true
          }
          if (node.nodeType === Node.TEXT_NODE) return true
        }
        return false
      })

      if (hasExternalChange) {
        if (debounceTimer.current) clearTimeout(debounceTimer.current)
        debounceTimer.current = setTimeout(() => {
          renderAnnotations(location.href)
        }, 3000)
      }
    })

    observer.observe(document.body, { subtree: true, childList: true, characterData: true })

    // Listen for storage changes from action-menu
    const storageListener = (changes: any, area: string) => {
      if (area !== "local") return
      const key = getKey(location.href)
      if (changes[key]) {
        renderAnnotations(location.href)
      }
    }
    chrome.storage?.onChanged?.addListener(storageListener)

    // Listen for messages from background (context menu, popup, side panel)
    const messageListener = (message: any, _sender: any, sendResponse: (r: any) => void) => {
      if (message.type === "TAB_UPDATED" && message.url === location.href) {
        renderAnnotations(location.href)
      } else if (message.type === "GET_ANNOTATION_POSITIONS" && message.annotations) {
        const positions: Record<string, number> = {}
        const config = getDomainConfig(location.href)
        const root = anchor.getRootElement(config.rootSelector)
        for (const ann of message.annotations as Annotation[]) {
          if (!ann.selector) {
            positions[ann.id] = Infinity
            continue
          }
          const range = anchor.resolveRange(root, ann.selector)
          if (range) {
            const rect = range.getBoundingClientRect()
            positions[ann.id] = rect.top + window.scrollY
          } else {
            positions[ann.id] = Infinity
          }
        }
        sendResponse({ type: "ANNOTATION_POSITIONS", positions })
        return true
      } else if (message.type === "SCROLL_TO_HIGHLIGHT" && message.annotationId) {
        const mark = document.querySelector<HTMLElement>(
          `mark.${HIGHLIGHT_CLASS}[data-omninotation-id="${message.annotationId}"]`
        )
        if (mark) {
          mark.scrollIntoView({ behavior: "smooth", block: "center" })
          mark.classList.add("omninotation-active")
          setTimeout(() => mark.classList.remove("omninotation-active"), 1500)
        }
      } else if (message.type === "CONTEXT_MENU_SAVE" && message.text) {
        const sel = window.getSelection()
        if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0)
          const config = getDomainConfig(location.href)
          const root = anchor.getRootElement(config.rootSelector)
          const selector = anchor.describeRange(root, range)
          if (selector) {
            saveAnnotation({
              id: crypto.randomUUID(),
              url: location.href,
              selector,
              quote: message.text.slice(0, 200),
              data: { type: "comment", content: "右键保存" },
              author: { id: "local-user", name: "Me" },
              visibility: "private",
              createdAt: new Date().toISOString()
            }).catch(() => {})
          }
        }
      }
    }
    chrome.runtime?.onMessage?.addListener(messageListener)

    return () => {
      disposeNav()
      observer.disconnect()
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      chrome.storage?.onChanged?.removeListener(storageListener)
      chrome.runtime?.onMessage?.removeListener(messageListener)
    }
  }, [renderAnnotations])

  if (!shouldActivate(url)) return null

  return (
    <>
      <ActionMenu />
      <SidebarContainer />
    </>
  )
}

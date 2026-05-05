import type { PlasmoCSConfig } from "plasmo"
import { useCallback, useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import cssText from "data-text:~/style.css"

import { SidebarContainer } from "@/components/SidebarContainer"
import * as anchor from "@/services/anchor"
import { getDomainConfig, shouldActivate } from "@/services/config"
import * as storage from "@/services/storage"
import type { Annotation, MarkStyle } from "@/types"

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
const STICKY_CLASS = "omninotation-sticky"
const PAGE_STYLE_ID = "omninotation-page-style"

function getMarkStyleCss(color: { bg: string; hover: string }): string {
  return `
    .${HIGHLIGHT_CLASS}.omninotation-style-highlight {
      cursor: pointer;
      background-color: ${color.bg} !important;
    }
    .${HIGHLIGHT_CLASS}.omninotation-style-highlight:hover {
      background-color: ${color.hover} !important;
    }
    .${HIGHLIGHT_CLASS}.omninotation-style-underline {
      cursor: pointer;
      border-bottom: 2px solid ${color.bg.replace(/[\d.]+\)$/, "0.8)")} !important;
      background-color: transparent !important;
    }
    .${HIGHLIGHT_CLASS}.omninotation-style-underline:hover {
      border-bottom-color: ${color.hover.replace(/[\d.]+\)$/, "0.9)")} !important;
    }
    .${HIGHLIGHT_CLASS}.omninotation-style-strikethrough {
      cursor: pointer;
      text-decoration: line-through !important;
      text-decoration-color: ${color.bg.replace(/[\d.]+\)$/, "0.7)")} !important;
      background-color: transparent !important;
    }
    .${HIGHLIGHT_CLASS}.omninotation-style-strikethrough:hover {
      text-decoration-color: ${color.hover.replace(/[\d.]+\)$/, "0.9)")} !important;
    }
    .${HIGHLIGHT_CLASS}.omninotation-style-squiggly {
      cursor: pointer;
      text-decoration: underline wavy !important;
      text-decoration-color: ${color.bg.replace(/[\d.]+\)$/, "0.7)")} !important;
      background-color: transparent !important;
    }
    .${HIGHLIGHT_CLASS}.omninotation-style-squiggly:hover {
      text-decoration-color: ${color.hover.replace(/[\d.]+\)$/, "0.9)")} !important;
    }
    .${STICKY_CLASS} {
      position: absolute;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: ${color.bg.replace(/[\d.]+\)$/, "0.6)")};
      border: 2px solid ${color.bg.replace(/[\d.]+\)$/, "0.9)")};
      cursor: pointer;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      transition: transform 0.2s, box-shadow 0.2s;
      box-shadow: 0 2px 4px rgba(0,0,0,0.15);
    }
    .${STICKY_CLASS}:hover {
      transform: scale(1.2);
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    }
    .${STICKY_CLASS}::after {
      content: "📌";
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

async function injectPageStyles() {
  const color = await storage.getHighlightColor()
  let style = document.getElementById(PAGE_STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement("style")
    style.id = PAGE_STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = getMarkStyleCss(color)
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

function clearStickies() {
  const stickies = document.querySelectorAll<HTMLElement>(`.${STICKY_CLASS}`)
  stickies.forEach((el) => el.remove())
}

function renderSticky(ann: Annotation) {
  if (!ann.position) return
  const existing = document.querySelector<HTMLElement>(`.${STICKY_CLASS}[data-omninotation-id="${ann.id}"]`)
  if (existing) return

  const sticky = document.createElement("div")
  sticky.className = STICKY_CLASS
  sticky.dataset.omninotationId = ann.id
  sticky.title = ann.data.content.slice(0, 100)
  sticky.style.left = `${ann.position.x}px`
  sticky.style.top = `${ann.position.y}px`

  sticky.addEventListener("click", (e) => {
    e.preventDefault()
    e.stopPropagation()
    chrome.runtime.sendMessage({
      type: "HIGHLIGHT_CLICKED",
      annotationId: ann.id
    }).catch(() => {})
  })

  document.body.appendChild(sticky)
}

function wrapRange(range: Range, id: string, type: "comment" | "edit", markStyle: string = "highlight") {
  const mark = document.createElement("mark")
  mark.className = `${HIGHLIGHT_CLASS} omninotation-style-${markStyle}`
  mark.dataset.omninotationId = id
  mark.dataset.omninotationType = type
  mark.dataset.omninotationStyle = markStyle

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
    null
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
  let urlChangeTimer: ReturnType<typeof setTimeout> | null = null
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href
      if (urlChangeTimer) clearTimeout(urlChangeTimer)
      urlChangeTimer = setTimeout(() => {
        callback()
      }, 300)
    }
  })
  observer.observe(document.documentElement, { subtree: true, childList: true })
  window.addEventListener("popstate", callback)
  window.addEventListener("hashchange", callback)
  return () => {
    observer.disconnect()
    if (urlChangeTimer) clearTimeout(urlChangeTimer)
    window.removeEventListener("popstate", callback)
    window.removeEventListener("hashchange", callback)
  }
}

function countRenderedAnnotations(): { marks: number; stickies: number } {
  return {
    marks: document.querySelectorAll(`mark.${HIGHLIGHT_CLASS}`).length,
    stickies: document.querySelectorAll(`.${STICKY_CLASS}`).length
  }
}

// ========================
// Component
// ========================

export default function OmniNotationOverlay() {
  const [url, setUrl] = useState(location.href)
  const isRendering = useRef(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stickyMode = useRef(false)
  const stickyTooltip = useRef<HTMLDivElement | null>(null)
  const lastSelectionRef = useRef<{ text: string; range: Range; rect?: DOMRect } | null>(null)
  const lastContextMenuPos = useRef<{ x: number; y: number } | null>(null)

  const renderAnnotations = useCallback((targetUrl: string) => {
    isRendering.current = true
    injectPageStyles().catch(() => {})
    clearHighlights()
    clearStickies()

    if (!shouldActivate(targetUrl)) {
      isRendering.current = false
      return
    }

    const key = storage.getKey(targetUrl)

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
          if (ann.selector) {
            const range = anchor.resolveRange(root, ann.selector)
            if (range) {
              try {
                wrapRange(range, ann.id, ann.data.type, ann.data.markStyle || "highlight")
              } catch (e) {
                console.warn("[OmniNotation] Failed to wrap highlight:", e)
              }
            }
          }
          if (ann.position) {
            renderSticky(ann)
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
        if (target.closest?.(`.${STICKY_CLASS}`)) return false
        for (let i = 0; i < m.addedNodes.length; i++) {
          const node = m.addedNodes[i]
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement
            if (el.classList?.contains(HIGHLIGHT_CLASS)) continue
            if (el.classList?.contains(STICKY_CLASS)) continue
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
            if (el.classList?.contains(STICKY_CLASS)) continue
            return true
          }
          if (node.nodeType === Node.TEXT_NODE) return true
        }
        return false
      })

      if (hasExternalChange) {
        if (debounceTimer.current) clearTimeout(debounceTimer.current)
        debounceTimer.current = setTimeout(() => {
          const key = storage.getKey(location.href)
          try {
            chrome.storage.local.get([key], (result) => {
              if (chrome.runtime.lastError) return
              const annotations: Annotation[] = result[key] ?? []
              const expectedMarks = annotations.filter((a) => a.selector).length
              const expectedStickies = annotations.filter((a) => a.position).length
              const { marks, stickies } = countRenderedAnnotations()
              if (marks !== expectedMarks || stickies !== expectedStickies) {
                renderAnnotations(location.href)
              }
            })
          } catch {
            renderAnnotations(location.href)
          }
        }, 1200)
      }
    })

    observer.observe(document.body, { subtree: true, childList: true, characterData: true })

    // Listen for storage changes from action-menu
    const storageListener = (changes: any, area: string) => {
      if (area !== "local") return
      const key = storage.getKey(location.href)
      if (changes[key]) {
        renderAnnotations(location.href)
      }
    }
    chrome.storage?.onChanged?.addListener(storageListener)

    // Track text selection and context menu position
    const handleSelectionChange = () => {
      const sel = window.getSelection()
      if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        const text = sel.toString().trim()
        if (text) {
          lastSelectionRef.current = { text, range, rect }
        }
      }
    }
    document.addEventListener("selectionchange", handleSelectionChange)
    document.addEventListener("mouseup", handleSelectionChange)

    const handleContextMenu = (e: MouseEvent) => {
      lastContextMenuPos.current = { x: e.clientX, y: e.clientY }
    }
    document.addEventListener("contextmenu", handleContextMenu)

    // Sticky note placement handler
    const handleStickyClick = (e: MouseEvent) => {
      if (!stickyMode.current) return
      const target = e.target as HTMLElement
      if (target.closest(`.${STICKY_CLASS}`)) return
      if (target.closest(`[data-omninotation-menu]`)) return

      e.preventDefault()
      e.stopPropagation()
      stickyMode.current = false

      // Remove tooltip
      if (stickyTooltip.current) {
        stickyTooltip.current.remove()
        stickyTooltip.current = null
      }
      document.body.style.cursor = ""

      const annotation: Annotation = {
        id: crypto.randomUUID(),
        url: location.href,
        title: document.title,
        position: { x: e.pageX - 12, y: e.pageY - 12 },
        data: { type: "comment", content: "" },
        author: { id: "local-user", name: "Me" },
        createdAt: new Date().toISOString()
      }
      storage.saveAnnotation(annotation).catch(() => {})
    }
    document.addEventListener("click", handleStickyClick, true)

    // Listen for messages from background (context menu, popup, side panel)
    const messageListener = (message: any, _sender: any, sendResponse: (r: any) => void) => {
      if (message.type === "TAB_UPDATED" && message.url === location.href) {
        renderAnnotations(location.href)
      } else if (message.type === "START_STICKY_MODE") {
        stickyMode.current = true
        document.body.style.cursor = "crosshair"
        // Show tooltip
        const tooltip = document.createElement("div")
        tooltip.textContent = "点击页面任意位置放置便签"
        tooltip.style.cssText = "position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#1f2937;color:white;padding:8px 16px;border-radius:8px;font-size:13px;z-index:2147483647;pointer-events:none;white-space:nowrap;"
        document.body.appendChild(tooltip)
        stickyTooltip.current = tooltip
      } else if (message.type === "GET_ANNOTATION_POSITIONS" && message.annotations) {
        const positions: Record<string, number> = {}
        const config = getDomainConfig(location.href)
        const root = anchor.getRootElement(config.rootSelector)
        for (const ann of message.annotations as Annotation[]) {
          if (ann.position) {
            positions[ann.id] = ann.position.y
            continue
          }
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
        } else {
          const sticky = document.querySelector<HTMLElement>(
            `.${STICKY_CLASS}[data-omninotation-id="${message.annotationId}"]`
          )
          if (sticky) {
            sticky.scrollIntoView({ behavior: "smooth", block: "center" })
            sticky.style.transform = "scale(1.5)"
            setTimeout(() => { sticky.style.transform = "" }, 1500)
          }
        }
      } else if (message.type === "CONTEXT_MENU_SAVE" && message.text) {
        const selInfo = lastSelectionRef.current
        const markStyle = (message.markStyle as MarkStyle) || "highlight"
        if (selInfo) {
          const config = getDomainConfig(location.href)
          const root = anchor.getRootElement(config.rootSelector)
          const selector = anchor.describeRange(root, selInfo.range)
          if (selector) {
            storage.saveAnnotation({
              id: crypto.randomUUID(),
              url: location.href,
              title: document.title,
              selector,
              quote: selInfo.text.slice(0, 200),
              data: { type: "comment", content: "", markStyle },
              author: { id: "local-user", name: "Me" },
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
      document.removeEventListener("click", handleStickyClick, true)
      document.removeEventListener("selectionchange", handleSelectionChange)
      document.removeEventListener("mouseup", handleSelectionChange)
      if (stickyTooltip.current) {
        stickyTooltip.current.remove()
        stickyTooltip.current = null
      }
    }
  }, [renderAnnotations])

  if (!shouldActivate(url)) return null

  return (
    <>
      <SidebarContainer />
    </>
  )
}

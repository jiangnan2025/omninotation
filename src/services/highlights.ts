import type { Annotation } from "@/types"
import * as storage from "./storage"

export const HIGHLIGHT_CLASS = "omninotation-highlight"
export const STICKY_CLASS = "omninotation-sticky"
export const PAGE_STYLE_ID = "omninotation-page-style"

export function getMarkStyleCss(color: { bg: string; hover: string }): string {
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

export async function injectPageStyles() {
  const color = await storage.getHighlightColor()
  let style = document.getElementById(PAGE_STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement("style")
    style.id = PAGE_STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = getMarkStyleCss(color)
}

export function clearHighlights() {
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

export function clearStickies() {
  document.querySelectorAll<HTMLElement>(`.${STICKY_CLASS}`).forEach((el) => el.remove())
}

export function renderSticky(ann: Annotation) {
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

export function wrapRange(range: Range, id: string, type: "comment" | "edit", markStyle: string = "highlight") {
  const mark = document.createElement("mark")
  mark.className = `${HIGHLIGHT_CLASS} omninotation-style-${markStyle}`
  mark.dataset.omninotationId = id
  mark.dataset.omninotationType = type
  mark.dataset.omninotationStyle = markStyle

  try {
    range.surroundContents(mark)
    attachMarkClick(mark, id)
    return
  } catch {
    // Range spans block boundaries — fall through
  }

  // Fallback: split by text nodes
  const textNodes: { node: Text; start: number; end: number }[] = []
  const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT, null)

  let node: Node | null
  while ((node = walker.nextNode())) {
    const textNode = node as Text
    const text = textNode.textContent || ""
    let start = 0
    let end = text.length

    if (textNode === range.startContainer) start = range.startOffset
    if (textNode === range.endContainer) end = range.endOffset

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

  textNodes.reverse().forEach(({ node, start, end }) => {
    const text = node.textContent || ""
    const before = text.slice(0, start)
    const selected = text.slice(start, end)
    const after = text.slice(end)
    if (!selected) return

    const fragment = document.createDocumentFragment()
    if (before) fragment.appendChild(document.createTextNode(before))

    const nodeMark = document.createElement("mark")
    nodeMark.className = `${HIGHLIGHT_CLASS} omninotation-style-${markStyle}`
    nodeMark.dataset.omninotationId = id
    nodeMark.dataset.omninotationType = type
    nodeMark.dataset.omninotationStyle = markStyle
    nodeMark.textContent = selected
    fragment.appendChild(nodeMark)

    if (after) fragment.appendChild(document.createTextNode(after))

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

export function countRenderedAnnotations(): { marks: number; stickies: number } {
  return {
    marks: document.querySelectorAll(`mark.${HIGHLIGHT_CLASS}`).length,
    stickies: document.querySelectorAll(`.${STICKY_CLASS}`).length
  }
}

export function observeSpaNavigation(callback: () => void) {
  let lastUrl = location.href
  let urlChangeTimer: ReturnType<typeof setTimeout> | null = null
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href
      if (urlChangeTimer) clearTimeout(urlChangeTimer)
      urlChangeTimer = setTimeout(callback, 300)
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

export function removeAnnotationFromDom(id: string) {
  const mark = document.querySelector<HTMLElement>(
    `mark.${HIGHLIGHT_CLASS}[data-omninotation-id="${id}"]`
  )
  if (mark) {
    const parent = mark.parentNode
    if (parent) {
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
      parent.removeChild(mark)
      parent.normalize()
    }
  }
  const sticky = document.querySelector<HTMLElement>(
    `.${STICKY_CLASS}[data-omninotation-id="${id}"]`
  )
  if (sticky) sticky.remove()
}

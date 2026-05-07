import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"

import * as anchor from "@/services/anchor"
import { getDomainConfig } from "@/services/config"
import { rangeToMarkdown } from "@/services/htmlToMarkdown"
import * as storage from "@/services/storage"
import { detectLocale, t, type Locale } from "@/services/i18n"
import type { MarkStyle, ToolbarConfig, ToolbarSearchEngine } from "@/types"

// ========================
// Helpers
// ========================

function getEngineIcon(engine: ToolbarSearchEngine): { type: "img" | "text"; value: string } {
  if (engine.favicon) {
    // If favicon looks like a URL, use it as image
    if (engine.favicon.startsWith("http") || engine.favicon.startsWith("data:")) {
      return { type: "img", value: engine.favicon }
    }
    // Otherwise treat as emoji/text icon
    return { type: "text", value: engine.favicon }
  }
  try {
    const domain = new URL(engine.urlTemplate.replace("{q}", "")).hostname
    return { type: "img", value: `https://www.google.com/s2/favicons?domain=${domain}&sz=32` }
  } catch {
    return { type: "text", value: engine.name.charAt(0) }
  }
}

interface SearchRequest {
  url: string
  method: "GET" | "POST"
  postBody?: string
}

function buildSearchRequest(engine: ToolbarSearchEngine, query: string): SearchRequest {
  const template = engine.urlTemplate
  if (template.includes("{POSTARGS}")) {
    const [urlPart, argsTemplate] = template.split("{POSTARGS}")
    const postBody = argsTemplate.replace(/%s/g, encodeURIComponent(query))
    return { url: urlPart, method: "POST", postBody }
  }
  return { url: template.replace(/%s/g, encodeURIComponent(query)), method: engine.method || "GET" }
}

function openGetUrl(url: string, mode: ToolbarConfig["tabOpenMode"]) {
  switch (mode) {
    case "current":
      window.open(url, "_self")
      break
    case "new-background-tab":
      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.sendMessage({ type: "OPEN_BACKGROUND_TAB", url }).catch(() => {
          window.open(url, "_blank")
        })
      } else {
        window.open(url, "_blank")
      }
      break
    case "pinned":
      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.sendMessage({ type: "OPEN_PINNED_TAB", url }).catch(() => {
          window.open(url, "_blank")
        })
      } else {
        window.open(url, "_blank")
      }
      break
    default:
      window.open(url, "_blank", "noopener,noreferrer")
  }
}

function submitPostSearch(url: string, postBody: string, target: string) {
  const form = document.createElement("form")
  form.action = url
  form.method = "POST"
  form.target = target
  form.style.display = "none"

  const params = new URLSearchParams(postBody)
  params.forEach((value, key) => {
    const input = document.createElement("input")
    input.type = "hidden"
    input.name = key
    input.value = value
    form.appendChild(input)
  })

  document.body.appendChild(form)
  form.submit()
  setTimeout(() => form.remove(), 100)
}

async function executeSearch(request: SearchRequest, mode: ToolbarConfig["tabOpenMode"]) {
  if (request.method === "POST" && request.postBody) {
    const target = mode === "current" ? "_self" : "_blank"
    submitPostSearch(request.url, request.postBody, target)
  } else {
    openGetUrl(request.url, mode)
  }
}

// ========================
// Annotation mark styles
// ========================

function getMarkStyles(locale: Locale): { key: MarkStyle; label: string; icon: string }[] {
  const L = t(locale)
  return [
    { key: "highlight", label: L.highlight, icon: "▌" },
    { key: "underline", label: L.underline, icon: "U̲" },
    { key: "strikethrough", label: L.strikethrough, icon: "S̶" },
    { key: "squiggly", label: L.squiggly, icon: "〰" }
  ]
}

// ========================
// Component
// ========================

export interface ToolbarSelection {
  text: string
  range: Range
  rect: DOMRect
}

interface SelectionToolbarProps {
  selection: ToolbarSelection
  config: ToolbarConfig
  onClose: () => void
}

export function SelectionToolbar({ selection, config, onClose }: SelectionToolbarProps) {
  const { text, range, rect } = selection
  const menuRef = useRef<HTMLDivElement>(null)
  const [showCommentForm, setShowCommentForm] = useState(false)
  const [comment, setComment] = useState("")
  const [markStyle, setMarkStyle] = useState<MarkStyle>("highlight")
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isOverSelection = useRef(false)
  const locale = useRef<Locale>(detectLocale()).current

  const L = t(locale)
  const MARK_STYLES = getMarkStyles(locale)
  const style = config.style

  // Auto-close after configured delay unless hovered
  const startCloseTimer = useCallback(() => {
    if (!config.autoClose) return
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => {
      onClose()
    }, config.autoCloseDelay)
  }, [config.autoClose, config.autoCloseDelay, onClose])

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [])

  // Detect hover over the selected text to keep menu open
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e
      const inRect =
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom

      if (inRect && !isOverSelection.current) {
        isOverSelection.current = true
        clearCloseTimer()
      } else if (!inRect && isOverSelection.current) {
        isOverSelection.current = false
        startCloseTimer()
      }
    }
    document.addEventListener("mousemove", handleMouseMove)
    return () => document.removeEventListener("mousemove", handleMouseMove)
  }, [rect, clearCloseTimer, startCloseTimer])

  useEffect(() => {
    startCloseTimer()
    return () => clearCloseTimer()
  }, [startCloseTimer, clearCloseTimer])

  // Position calculation (viewport-relative because root container is fixed)
  useLayoutEffect(() => {
    const el = menuRef.current
    if (!el) return
    const menuRect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    let top = rect.bottom + 8
    let left = rect.left + rect.width / 2 - menuRect.width / 2

    // Flip to top if near bottom edge
    if (top + menuRect.height + 8 > vh) {
      top = rect.top - menuRect.height - 8
    }

    // Clamp horizontally
    left = Math.max(8, Math.min(left, vw - menuRect.width - 8))

    el.style.top = `${top}px`
    el.style.left = `${left}px`
  }, [rect])

  // Close on click outside / scroll / selection loss
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleScroll = () => onClose()
    const handleSelectionChange = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) {
        onClose()
      }
    }

    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleMouseDown)
      document.addEventListener("scroll", handleScroll, true)
      document.addEventListener("selectionchange", handleSelectionChange)
    }, 80)

    return () => {
      clearTimeout(timer)
      document.removeEventListener("mousedown", handleMouseDown)
      document.removeEventListener("scroll", handleScroll, true)
      document.removeEventListener("selectionchange", handleSelectionChange)
    }
  }, [onClose])

  const saveAnnotation = useCallback(
    async (styleArg: MarkStyle, userContent: string = "") => {
      const cfg = getDomainConfig(location.href)
      const root = anchor.getRootElement(cfg.rootSelector)
      const selector = anchor.describeRange(root, range)
      if (!selector) {
        alert(L.anchorFailed)
        return
      }

      // Convert selected HTML to markdown to preserve formatting
      const selectedMarkdown = rangeToMarkdown(range) || text

      // quote = markdown formatted selected text; content = user's comment
      await storage.saveAnnotation({
        id: crypto.randomUUID(),
        url: location.href,
        title: document.title,
        selector,
        quote: selectedMarkdown.slice(0, 2000),
        data: { type: "comment", content: userContent.trim(), markStyle: styleArg },
        author: { id: "local-user", name: "Me" },
        createdAt: new Date().toISOString()
      })

      onClose()
    },
    [range, text, onClose]
  )

  const handleSearch = useCallback(
    async (engine: ToolbarSearchEngine) => {
      const request = buildSearchRequest(engine, text)
      await executeSearch(request, config.tabOpenMode)
      if (config.autoClose) {
        onClose()
      }
    },
    [text, config.tabOpenMode, config.autoClose, onClose]
  )

  const containerStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 2147483647,
    backgroundColor: style.backgroundColor,
    borderRadius: `${style.borderRadius}px`,
    padding: `${style.padding}px`,
    boxShadow: style.shadow,
    color: style.textColor,
    display: "flex",
    alignItems: "center",
    gap: `${style.gap}px`
  }

  const buttonSize = style.buttonSize
  const buttonStyle: React.CSSProperties = {
    width: `${buttonSize}px`,
    height: `${buttonSize}px`,
    borderRadius: `${Math.max(4, style.borderRadius - 4)}px`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontSize: `${Math.max(10, buttonSize * 0.4)}px`,
    lineHeight: 1,
    padding: 0,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    color: style.textColor
  }

  const dividerStyle: React.CSSProperties = {
    width: "1px",
    height: `${buttonSize * 0.6}px`,
    backgroundColor: "rgba(0,0,0,0.1)",
    flexShrink: 0
  }

  const enabledEngines = config.engines.filter((e) => e.enabled)

  const renderEngineButton = (engine: ToolbarSearchEngine) => {
    const icon = getEngineIcon(engine)
    return (
      <button
        key={engine.id}
        title={config.showFaviconOnly ? engine.name : L.searchIn(engine.name)}
        onClick={() => handleSearch(engine)}
        style={buttonStyle}
        onMouseEnter={clearCloseTimer}
        onMouseLeave={startCloseTimer}
      >
        {icon.type === "img" ? (
          <img
            src={icon.value}
            alt={engine.name}
            className="object-contain"
            style={{ width: buttonSize * 0.5, height: buttonSize * 0.5 }}
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.style.display = "none"
            }}
          />
        ) : (
          <span>{icon.value}</span>
        )}
        {!config.showFaviconOnly && (
          <span className="ml-1 truncate" style={{ maxWidth: 60, fontSize: `${Math.max(9, buttonSize * 0.32)}px` }}>
            {engine.name}
          </span>
        )}
      </button>
    )
  }

  if (showCommentForm) {
    return (
      <div
        ref={menuRef}
        style={containerStyle}
        className="w-64"
        onMouseEnter={clearCloseTimer}
        onMouseLeave={startCloseTimer}
        onMouseDown={(e) => e.preventDefault()}
      >
        <div className="text-xs opacity-60 mb-1">{L.addComment}</div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={L.commentPlaceholder}
          className="w-full text-xs border border-gray-200 rounded p-2 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          style={{ backgroundColor: "white", color: "#374151" }}
          rows={3}
          autoFocus
        />
        <div className="flex gap-1 mb-2">
          {MARK_STYLES.map(({ key, label: lbl, icon }) => (
            <button
              key={key}
              onClick={() => setMarkStyle(key)}
              title={lbl}
              className={`flex-1 text-xs py-1 rounded border transition-colors ${
                markStyle === key
                  ? "bg-blue-50 border-blue-300 text-blue-700"
                  : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              {icon}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setShowCommentForm(false)}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-50"
          >
            {L.back}
          </button>
          <button
            onClick={() => saveAnnotation(markStyle, comment)}
            disabled={!comment.trim()}
            className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {L.save}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={menuRef}
      style={containerStyle}
      onMouseEnter={clearCloseTimer}
      onMouseLeave={startCloseTimer}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Annotation mark styles */}
      {config.showAnnotations && (
        <>
          {MARK_STYLES.map(({ key, label: lbl, icon }) => (
            <button
              key={key}
              title={lbl}
              onClick={() => saveAnnotation(key)}
              style={buttonStyle}
            >
              {icon}
            </button>
          ))}
          <button
            title={L.addComment}
            onClick={() => setShowCommentForm(true)}
            style={buttonStyle}
          >
            📝
          </button>
          {enabledEngines.length > 0 && <div style={dividerStyle} />}
        </>
      )}

      {/* Search engines */}
      {enabledEngines.map(renderEngineButton)}
    </div>
  )
}

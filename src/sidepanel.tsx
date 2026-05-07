import { useCallback, useEffect, useRef, useState } from "react"
import "katex/dist/katex.min.css"
import "./style.css"

import { initLocale, setLocale, t, getLocale, type Locale } from "@/services/i18n"
import { exportPageAnnotations, importPageAnnotations } from "@/services/storage"
import * as storage from "@/services/storage"
import type { Annotation, Reply } from "@/types"
import { AnnotationCard } from "@/components/AnnotationCard"
import { ToolbarSettings } from "@/components/ToolbarSettings"

export default function SidePanel() {
  const [locale, setLocaleState] = useState<Locale>(getLocale)
  const L = t(locale)
  const [url, setUrl] = useState("")
  const [title, setTitle] = useState("")
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [displayAnnotations, setDisplayAnnotations] = useState<Annotation[]>([])
  const [customOrder, setCustomOrder] = useState<string[] | null>(null)
  const [bookmarked, setBookmarked] = useState(false)
  const [bookmarkTime, setBookmarkTime] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newContent, setNewContent] = useState("")
  const [highlightColor, setHighlightColor] = useState("rgba(250, 204, 21, 0.3)")
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [pendingEditIds, setPendingEditIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")
  const [bookmarkTags, setBookmarkTags] = useState<string[]>([])
  const [showTagInput, setShowTagInput] = useState(false)
  const [tagInput, setTagInput] = useState("")
  const listRef = useRef<HTMLDivElement>(null)
  const pendingEditIdsRef = useRef<Set<string>>(new Set())
  const annotationsRef = useRef<Annotation[]>([])
  const customOrderRef = useRef<string[] | null>(null)
  useEffect(() => {
    pendingEditIdsRef.current = pendingEditIds
  }, [pendingEditIds])
  useEffect(() => {
    annotationsRef.current = annotations
  }, [annotations])
  useEffect(() => {
    customOrderRef.current = customOrder
  }, [customOrder])

  const matchesSearch = useCallback((ann: Annotation, query: string): boolean => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    const searchReplies = (replies: Reply[]): boolean =>
      replies.some((r) =>
        r.content.toLowerCase().includes(q) ||
        (r.replies ? searchReplies(r.replies) : false)
      )
    return (
      ann.data.content.toLowerCase().includes(q) ||
      (ann.quote?.toLowerCase().includes(q) ?? false) ||
      (ann.replies ? searchReplies(ann.replies) : false)
    )
  }, [])

  const applySort = useCallback((anns: Annotation[], positions: Record<string, number>, order: string[] | null) => {
    if (order && order.length > 0) {
      const orderMap = new Map(order.map((id, i) => [id, i]))
      const sorted = [...anns].sort((a, b) => {
        const oa = orderMap.get(a.id)
        const ob = orderMap.get(b.id)
        if (oa !== undefined && ob !== undefined) return oa - ob
        if (oa !== undefined) return -1
        if (ob !== undefined) return 1
        return (positions[a.id] ?? Infinity) - (positions[b.id] ?? Infinity)
      })
      return sorted
    }
    return [...anns].sort((a, b) => (positions[a.id] ?? Infinity) - (positions[b.id] ?? Infinity))
  }, [])

  const fetchPositionsAndSort = useCallback(async (anns: Annotation[], order: string[] | null) => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: "GET_ANNOTATION_POSITIONS",
          annotations: anns
        }, (response) => {
          if (chrome.runtime.lastError) {
            setDisplayAnnotations(anns)
            return
          }
          if (response?.type === "ANNOTATION_POSITIONS") {
            setDisplayAnnotations(applySort(anns, response.positions, order))
          }
        })
      } else {
        setDisplayAnnotations(anns)
      }
    } catch {
      setDisplayAnnotations(anns)
    }
  }, [applySort])

  const load = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.url) {
        setUrl(tab.url)
        setTitle(tab.title || "")
        const data = await storage.getAnnotations(tab.url)
        setAnnotations(data)
        const order = await storage.getAnnotationOrder(tab.url)
        setCustomOrder(order.length > 0 ? order : null)
        const color = await storage.getHighlightColor()
        setHighlightColor(color.bg)
        const bookmarks = await storage.getBookmarks()
        const currentBm = bookmarks.find((b) => b.url === tab.url)
        setBookmarked(!!currentBm)
        setBookmarkTime(currentBm?.createdAt || null)
        setBookmarkTags(currentBm?.tags || [])
        await fetchPositionsAndSort(data, order.length > 0 ? order : null)
      }
    } catch (e) {
      console.error("[SidePanel] load error:", e)
    }
  }

  // Initialize locale from storage on mount
  useEffect(() => {
    initLocale().then((l) => setLocaleState(l))
  }, [])

  // Listen for locale changes in storage (from other contexts)
  useEffect(() => {
    const listener = (changes: any, area: string) => {
      if (area !== "local" || !changes["locale_pref"]) return
      const newLocale = changes["locale_pref"].newValue as Locale
      if (newLocale === "zh-CN" || newLocale === "en") {
        setLocaleState(newLocale)
      }
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  useEffect(() => {
    load()

    const onActivated = () => load()
    const onUpdated = (_tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (changeInfo.status === "complete" || changeInfo.url) {
        load()
      }
    }
    chrome.tabs.onActivated.addListener(onActivated)
    chrome.tabs.onUpdated.addListener(onUpdated)

    const onStorageChanged = (changes: any, area: string) => {
      if (area !== "local") return
      const key = storage.getKey(url)
      if (url && changes[key]) {
        const newAnns = changes[key].newValue as Annotation[] | undefined
        const oldAnns = changes[key].oldValue as Annotation[] | undefined
        if (newAnns) {
          // Only update if actually different from current state (avoid overwriting optimistic updates)
          const currentIds = new Set(annotationsRef.current.map((a) => a.id))
          const newIds = new Set(newAnns.map((a) => a.id))
          const idsChanged = currentIds.size !== newIds.size || newAnns.some((a) => !currentIds.has(a.id)) || annotationsRef.current.some((a) => !newIds.has(a.id))
          if (idsChanged) {
            setAnnotations(newAnns)
            fetchPositionsAndSort(newAnns, customOrderRef.current)
          }
          // Auto-edit empty annotations from context menu — only when newly added
          if (!oldAnns || newAnns.length > oldAnns.length) {
            const emptyIds = newAnns
              .filter((a) => a.data.content === "" && !pendingEditIdsRef.current.has(a.id))
              .map((a) => a.id)
            if (emptyIds.length > 0) {
              setPendingEditIds((prev) => {
                const next = new Set(prev)
                emptyIds.forEach((id) => next.add(id))
                return next
              })
            }
          }
        }
      }
      if (changes["bookmarks"]) {
        load()
      }
      if (changes["highlight_color"]) {
        storage.getHighlightColor().then((c) => setHighlightColor(c.bg))
      }
    }
    chrome.storage.onChanged.addListener(onStorageChanged)

    const messageListener = (message: any) => {
      if (message.type === "HIGHLIGHT_CLICKED" && message.annotationId) {
        const element = document.querySelector<HTMLElement>(
          `[data-annotation-id="${message.annotationId}"]`
        )
        if (element && listRef.current) {
          element.scrollIntoView({ behavior: "smooth", block: "center" })
          element.classList.add("ring-2", "ring-blue-500", "ring-offset-1")
          setTimeout(() => {
            element.classList.remove("ring-2", "ring-blue-500", "ring-offset-1")
          }, 1500)
        }
      }
    }
    chrome.runtime?.onMessage?.addListener(messageListener)

    return () => {
      chrome.tabs.onActivated.removeListener(onActivated)
      chrome.tabs.onUpdated.removeListener(onUpdated)
      chrome.storage.onChanged.removeListener(onStorageChanged)
      chrome.runtime?.onMessage?.removeListener(messageListener)
    }
  }, [url])

  const handleDelete = useCallback(async (id: string) => {
    // Optimistically update UI state immediately to avoid async re-render issues
    const nextAnns = annotations.filter((a) => a.id !== id)
    setAnnotations(nextAnns)
    setDisplayAnnotations(nextAnns)
    setPendingEditIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    if (customOrder) {
      const nextOrder = customOrder.filter((oid) => oid !== id)
      setCustomOrder(nextOrder.length > 0 ? nextOrder : null)
      await storage.saveAnnotationOrder(url, nextOrder)
    }
    await storage.deleteAnnotation(url, id)
  }, [url, customOrder, annotations])

  const handleReplyAdded = useCallback((annId: string, reply: Reply) => {
    const updater = (prev: Annotation[]) =>
      prev.map((a) =>
        a.id === annId ? { ...a, replies: [...(a.replies || []), reply] } : a
      )
    setAnnotations(updater)
    setDisplayAnnotations(updater)
  }, [])

  const handleReplyDeleted = useCallback((annId: string, replyId: string) => {
    const deleteRecursive = (replies: Reply[]): Reply[] => {
      const filtered = replies.filter((r) => r.id !== replyId)
      return filtered.map((r) =>
        r.replies ? { ...r, replies: deleteRecursive(r.replies) } : r
      )
    }
    const updater = (prev: Annotation[]) =>
      prev.map((a) =>
        a.id === annId && a.replies
          ? { ...a, replies: deleteRecursive(a.replies) }
          : a
      )
    setAnnotations(updater)
    setDisplayAnnotations(updater)
  }, [])

  const handleReplyEdited = useCallback((annId: string, replyId: string, content: string) => {
    const editRecursive = (replies: Reply[]): Reply[] =>
      replies.map((r) => {
        if (r.id === replyId) return { ...r, content }
        if (r.replies) return { ...r, replies: editRecursive(r.replies) }
        return r
      })
    const updater = (prev: Annotation[]) =>
      prev.map((a) =>
        a.id === annId && a.replies
          ? { ...a, replies: editRecursive(a.replies) }
          : a
      )
    setAnnotations(updater)
    setDisplayAnnotations(updater)
  }, [])

  const handleEditAnnotation = useCallback(async (annId: string, content: string) => {
    await storage.updateAnnotationContent(url, annId, content)
    const updater = (prev: Annotation[]) =>
      prev.map((a) =>
        a.id === annId ? { ...a, data: { ...a.data, content } } : a
      )
    setAnnotations(updater)
    setDisplayAnnotations(updater)
    // Remove from pending edit once saved
    setPendingEditIds((prev) => {
      const next = new Set(prev)
      next.delete(annId)
      return next
    })
  }, [url])

  const handleStatusToggle = useCallback(async (annId: string) => {
    const ann = annotations.find((a) => a.id === annId)
    if (!ann) return
    const newStatus: "open" | "resolved" = ann.status === "resolved" ? "open" : "resolved"
    await storage.updateAnnotationStatus(url, annId, newStatus)
    const updater = (prev: Annotation[]) =>
      prev.map((a) => (a.id === annId ? { ...a, status: newStatus } : a))
    setAnnotations(updater)
    setDisplayAnnotations(updater)
  }, [url, annotations])

  const handleBookmarkTagAdd = async () => {
    const trimmed = tagInput.trim()
    if (!trimmed || !url) return
    const bookmarks = await storage.getBookmarks()
    const bm = bookmarks.find((b) => b.url === url)
    if (!bm) return
    const newTags = [...(bm.tags || [])]
    if (!newTags.includes(trimmed)) {
      newTags.push(trimmed)
      await storage.updateBookmarkTags(url, newTags)
      setBookmarkTags(newTags)
    }
    setTagInput("")
    setShowTagInput(false)
  }

  const handleBookmarkTagRemove = async (tag: string) => {
    if (!url) return
    const newTags = bookmarkTags.filter((t) => t !== tag)
    await storage.updateBookmarkTags(url, newTags)
    setBookmarkTags(newTags)
  }

  const handleNestedReplyAdded = useCallback((annId: string, parentReplyId: string, reply: Reply) => {
    const updater = (prev: Annotation[]) =>
      prev.map((a) => {
        if (a.id !== annId || !a.replies) return a
        const addToParent = (replies: Reply[]): Reply[] =>
          replies.map((r) => {
            if (r.id === parentReplyId) {
              return { ...r, replies: [...(r.replies || []), reply] }
            }
            if (r.replies) {
              return { ...r, replies: addToParent(r.replies) }
            }
            return r
          })
        return { ...a, replies: addToParent(a.replies) }
      })
    setAnnotations(updater)
    setDisplayAnnotations(updater)
  }, [])

  const handleAddSticky = async () => {
    if (!url) return
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: "START_STICKY_MODE" }).catch(() => {
        alert(L.cannotCommunicate)
      })
    }
  }

  const handleAddAnnotation = async () => {
    if (!newContent.trim() || !url) return
    const annotation: Annotation = {
      id: crypto.randomUUID(),
      url,
      title: title || url,
      data: { type: "comment", content: newContent.trim() },
      author: { id: "local-user", name: "Me" },
      createdAt: new Date().toISOString()
    }
    await storage.saveAnnotation(annotation)
    setBookmarked(true)
    const next = [...annotations, annotation]
    setAnnotations(next)
    setNewContent("")
    setShowAddForm(false)
    await fetchPositionsAndSort(next, customOrder)
  }

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    setDraggingId(id)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", id)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    if (id !== draggingId) {
      setDragOverId(id)
    }
  }

  const handleDragLeave = () => {
    setDragOverId(null)
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault()
    setDragOverId(null)
    const draggedId = e.dataTransfer.getData("text/plain")
    if (!draggedId || draggedId === targetId) return

    const fromIndex = displayAnnotations.findIndex((a) => a.id === draggedId)
    const toIndex = displayAnnotations.findIndex((a) => a.id === targetId)
    if (fromIndex === -1 || toIndex === -1) return

    const next = [...displayAnnotations]
    const [removed] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, removed)

    setDisplayAnnotations(next)
    const newOrder = next.map((a) => a.id)
    setCustomOrder(newOrder)
    await storage.saveAnnotationOrder(url, newOrder)
  }

  const handleDragEnd = () => {
    setDraggingId(null)
    setDragOverId(null)
  }

  const handleResetOrder = async () => {
    setCustomOrder(null)
    await storage.saveAnnotationOrder(url, [])
    await fetchPositionsAndSort(annotations, null)
  }

  const handleExport = async () => {
    const data = await storage.exportAllData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const urlObj = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = urlObj
    a.download = `omninotation-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(urlObj)
  }

  const handleImport = async (file: File) => {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (typeof data !== "object" || data === null) {
        alert(L.invalidJsonError)
        return
      }
      if (!confirm(L.importConfirm)) return
      await storage.importAllData(data)
      alert(L.importSuccess)
      load()
    } catch (e) {
      alert(L.importFailed(e instanceof Error ? e.message : String(e)))
    }
  }

  const handleExportPage = async () => {
    if (!url) return
    const data = await storage.exportPageAnnotations(url)
    if (Object.keys(data).length === 0) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const urlObj = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = urlObj
    const safeName = title.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, "_").slice(0, 50) || "page"
    a.download = `omninotation-${safeName}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(urlObj)
  }

  const handleImportPage = async (file: File) => {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (typeof data !== "object" || data === null) {
        alert(L.invalidJsonError)
        return
      }
      if (!confirm(L.importPageConfirm)) return
      const ok = await storage.importPageAnnotations(url, data)
      if (ok) {
        alert(L.importPageSuccess)
        load()
      } else {
        alert(L.importPageFail)
      }
    } catch (e) {
      alert(L.importFailed(e instanceof Error ? e.message : String(e)))
    }
  }

  const handleColorChange = async (color: string) => {
    const colors: Record<string, { bg: string; hover: string }> = {
      yellow: { bg: "rgba(250, 204, 21, 0.3)", hover: "rgba(250, 204, 21, 0.6)" },
      blue: { bg: "rgba(59, 130, 246, 0.3)", hover: "rgba(59, 130, 246, 0.6)" },
      green: { bg: "rgba(34, 197, 94, 0.3)", hover: "rgba(34, 197, 94, 0.6)" },
      red: { bg: "rgba(239, 68, 68, 0.3)", hover: "rgba(239, 68, 68, 0.6)" },
      purple: { bg: "rgba(168, 85, 247, 0.3)", hover: "rgba(168, 85, 247, 0.6)" },
      orange: { bg: "rgba(249, 115, 22, 0.3)", hover: "rgba(249, 115, 22, 0.6)" }
    }
    const selected = colors[color] || colors.yellow
    await storage.setHighlightColor(selected)
    setHighlightColor(selected.bg)
    const tabs = await chrome.tabs.query({})
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: "TAB_UPDATED",
          url: tab.url || ""
        }).catch(() => {})
      }
    }
  }

  return (
    <div className="flex flex-col h-screen bg-white" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold text-gray-800 truncate">{title || L.untitledPage}</h1>
          <p className="text-[10px] text-gray-400 truncate">
            {(() => { try { return decodeURIComponent(url).replace(/^https?:\/\//, "") } catch { return url.replace(/^https?:\/\//, "") } })() || L.unselectedPage}
          </p>
        </div>
        <div className="flex flex-col items-end ml-2 gap-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => chrome.runtime.openOptionsPage()}
              className="text-xs text-gray-400 hover:text-blue-600"
              title={L.openDashboard}>
              📊
            </button>
            <button
              onClick={async () => {
                if (!url) return
                if (bookmarked) {
                  await storage.removeBookmark(url)
                  setBookmarked(false)
                  setBookmarkTime(null)
                } else {
                  const now = new Date().toISOString()
                  await storage.addBookmark({
                    id: crypto.randomUUID(),
                    url,
                    title: title || url,
                    createdAt: now
                  })
                  setBookmarked(true)
                  setBookmarkTime(now)
                }
              }}
              className={`text-lg leading-none transition-colors ${
                bookmarked ? "text-yellow-500" : "text-gray-300 hover:text-gray-400"
              }`}
              title={bookmarked ? L.unbookmark : L.bookmark}>
              {bookmarked ? "⭐" : "☆"}
            </button>
          </div>
          {bookmarkTime && (
            <span className="text-[9px] text-gray-400">
              {new Date(bookmarkTime).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Page tags */}
      <div className="px-4 py-1.5 border-b border-gray-100 shrink-0">
        <div className="flex items-center flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
          {bookmarkTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {tag}
              <button
                onClick={() => handleBookmarkTagRemove(tag)}
                className="text-amber-500 hover:text-amber-800 ml-0.5">
                ×
              </button>
            </span>
          ))}
          {showTagInput ? (
            <div className="flex items-center gap-1">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleBookmarkTagAdd()
                  if (e.key === "Escape") { setShowTagInput(false); setTagInput("") }
                }}
                placeholder={L.tagPlaceholder}
                autoFocus
                className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 w-20 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={handleBookmarkTagAdd}
                disabled={!tagInput.trim()}
                className="text-[10px] text-blue-600 hover:text-blue-800 disabled:text-gray-300">
                {L.save}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowTagInput(true)}
              className="text-[10px] text-gray-400 hover:text-blue-600 px-1 py-0.5 rounded border border-dashed border-gray-300 hover:border-blue-300">
              {L.addTag}
            </button>
          )}
        </div>
      </div>

      {/* Color picker */}
      <div className="px-4 py-1.5 border-b border-gray-100 shrink-0 flex items-center gap-2">
        <span className="text-[10px] text-gray-400">{L.highlightColor}</span>
        {[
          { key: "yellow", color: "bg-yellow-400" },
          { key: "blue", color: "bg-blue-400" },
          { key: "green", color: "bg-green-400" },
          { key: "red", color: "bg-red-400" },
          { key: "purple", color: "bg-purple-400" },
          { key: "orange", color: "bg-orange-400" }
        ].map(({ key, color }) => (
          <button
            key={key}
            onClick={() => handleColorChange(key)}
            className={`w-4 h-4 rounded-full ${color} border-2 ${
              highlightColor.includes(key === "yellow" ? "250, 204, 21" :
                key === "blue" ? "59, 130, 246" :
                key === "green" ? "34, 197, 94" :
                key === "red" ? "239, 68, 68" :
                key === "purple" ? "168, 85, 247" :
                "249, 115, 22")
                ? "border-gray-800"
                : "border-transparent"
            } hover:scale-110 transition-transform`}
            title={key}
          />
        ))}
      </div>

      {/* Toolbar settings */}
      <ToolbarSettings locale={locale} />

      {/* Add annotation button */}
      <div className="px-4 py-2 border-b border-gray-100 shrink-0">
        {showAddForm ? (
          <div className="space-y-1">
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder={L.pageNotePlaceholder}
              className="w-full text-xs border border-gray-200 rounded p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              rows={4}
            />
            <div className="flex gap-1 justify-end">
              <button
                onClick={() => {
                  setShowAddForm(false)
                  setNewContent("")
                }}
                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 rounded border border-gray-200 hover:bg-gray-50">
                {L.cancel}
              </button>
              <button
                onClick={handleAddAnnotation}
                disabled={!newContent.trim()}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {L.save}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddForm(true)}
              className="flex-1 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
              {L.addNote}
            </button>
            <button
              onClick={handleAddSticky}
              className="px-3 py-1.5 text-xs bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors"
              title={L.stickyNoteBtn}>
              {L.stickyNoteBtn}
            </button>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="px-4 py-1.5 border-b border-gray-100 shrink-0">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={L.searchNotePlaceholder}
          className="w-full text-[11px] border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* List */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-gray-100 shrink-0">
        <span className="text-[10px] text-gray-400">
          {searchQuery.trim()
            ? L.searchResults(displayAnnotations.filter((a) => matchesSearch(a, searchQuery)).length)
            : customOrder ? L.customSort : L.positionSort}
        </span>
        {customOrder && !searchQuery.trim() && (
          <button
            onClick={handleResetOrder}
            className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline">
            {L.resetToPositionSort}
          </button>
        )}
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {displayAnnotations.filter((a) => matchesSearch(a, searchQuery)).length === 0 && (
          <div className="text-center text-gray-400 text-sm py-8">
            {url
              ? searchQuery.trim()
                ? L.noMatchResults
                : L.noNotesAddPrompt
              : L.selectTabPrompt}
          </div>
        )}
        {displayAnnotations.filter((a) => matchesSearch(a, searchQuery)).map((ann) => (
          <AnnotationCard
            key={ann.id}
            ann={ann}
            url={url}
            onDelete={handleDelete}
            onReplyAdded={handleReplyAdded}
            onReplyDeleted={handleReplyDeleted}
            onReplyEdited={handleReplyEdited}
            onNestedReplyAdded={handleNestedReplyAdded}
            onEdit={handleEditAnnotation}
            onStatusToggle={handleStatusToggle}
            autoEdit={pendingEditIds.has(ann.id)}
            draggable
            isDragging={draggingId === ann.id}
            isDragOver={dragOverId === ann.id}
            onDragStart={(e) => handleDragStart(e, ann.id)}
            onDragOver={(e) => handleDragOver(e, ann.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, ann.id)}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-100 shrink-0">
        <div className="flex items-center justify-between mb-1">
          {/* Language switcher */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-400">{L.languageLabel}:</span>
            <button
              onClick={async () => {
                const next: Locale = locale === "zh-CN" ? "en" : "zh-CN"
                await setLocale(next)
                setLocaleState(next)
              }}
              className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                locale === "zh-CN"
                  ? "bg-blue-50 border-blue-300 text-blue-700"
                  : "bg-gray-50 border-gray-200 text-gray-500"
              }`}>
              中文
            </button>
            <button
              onClick={async () => {
                const next: Locale = locale === "zh-CN" ? "en" : "zh-CN"
                await setLocale(next)
                setLocaleState(next)
              }}
              className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                locale === "en"
                  ? "bg-blue-50 border-blue-300 text-blue-700"
                  : "bg-gray-50 border-gray-200 text-gray-500"
              }`}>
              EN
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-400">
            {L.pageNoteCount(displayAnnotations.length)}
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleExportPage}
              className="text-[10px] text-gray-500 hover:text-blue-600 hover:underline">
              {L.exportPage}
            </button>
            <label className="text-[10px] text-gray-500 hover:text-blue-600 hover:underline cursor-pointer">
              {L.importPage}
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleImportPage(file)
                  e.target.value = ""
                }}
              />
            </label>
            <button
              onClick={handleExport}
              className="text-[10px] text-gray-500 hover:text-blue-600 hover:underline">
              {L.exportBtn}
            </button>
            <label className="text-[10px] text-gray-500 hover:text-blue-600 hover:underline cursor-pointer">
              {L.importBtn}
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleImport(file)
                  e.target.value = ""
                }}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}

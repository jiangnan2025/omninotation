import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { marked } from "marked"
import "./style.css"

import * as storage from "@/services/storage"
import type { Annotation, Reply } from "@/types"

function MarkdownContent({ text }: { text: string }) {
  const html = useMemo(() => {
    return marked.parse(text, { breaks: true, gfm: true }) as string
  }, [text])
  return (
    <div
      className="markdown-body text-xs text-gray-800 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function ReplyItem({
  reply,
  onDelete
}: {
  reply: Reply
  onDelete: () => void
}) {
  return (
    <div className="bg-white rounded border border-gray-100 p-2">
      <MarkdownContent text={reply.content} />
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-gray-400">
          {new Date(reply.createdAt).toLocaleString()}
        </span>
        <button
          onClick={onDelete}
          className="text-[10px] text-red-400 hover:text-red-600 hover:underline">
          删除
        </button>
      </div>
    </div>
  )
}

function AnnotationCard({
  ann,
  url,
  onDelete,
  onReplyAdded,
  onReplyDeleted,
  draggable,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd
}: {
  ann: Annotation
  url: string
  onDelete: (id: string) => void
  onReplyAdded: (annId: string, reply: Reply) => void
  onReplyDeleted: (annId: string, replyId: string) => void
  draggable?: boolean
  isDragging?: boolean
  isDragOver?: boolean
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void
  onDragLeave?: (e: React.DragEvent<HTMLDivElement>) => void
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void
}) {
  const [replyText, setReplyText] = useState("")
  const [showReply, setShowReply] = useState(false)

  const handleAddReply = async () => {
    if (!replyText.trim() || !url) return
    const reply: Reply = {
      id: crypto.randomUUID(),
      content: replyText.trim(),
      createdAt: new Date().toISOString()
    }
    await storage.addReply(url, ann.id, reply)
    onReplyAdded(ann.id, reply)
    setReplyText("")
  }

  const handleDeleteReply = async (replyId: string) => {
    if (!url) return
    await storage.deleteReply(url, ann.id, replyId)
    onReplyDeleted(ann.id, replyId)
  }

  const scrollToHighlight = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: "SCROLL_TO_HIGHLIGHT",
        annotationId: ann.id
      }).catch(() => {})
    }
  }

  return (
    <div
      data-annotation-id={ann.id}
      onClick={scrollToHighlight}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`rounded-lg border p-3 cursor-pointer transition-all ${
        isDragging
          ? "opacity-50 border-dashed border-blue-300 bg-blue-50"
          : isDragOver
          ? "border-blue-400 bg-blue-50 shadow-md"
          : "border-gray-100 bg-gray-50 hover:shadow-md"
      }`}
      title="点击跳转到网页对应位置">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
            批注
          </span>
          <span className="text-[10px] text-gray-400">
            {new Date(ann.createdAt).toLocaleString()}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(ann.id)
          }}
          className="text-xs text-red-500 hover:text-red-700 hover:underline">
          删除
        </button>
      </div>

      {/* Quote (if has selected text) */}
      {ann.quote && (
        <p className="text-xs text-gray-500 mb-2 line-clamp-2 italic">"{ann.quote}"</p>
      )}

      {/* Content */}
      <div className="mb-2">
        <MarkdownContent text={ann.data.content} />
      </div>

      {/* Replies */}
      {ann.replies && ann.replies.length > 0 && (
        <div className="mt-2 space-y-2 border-t border-gray-200 pt-2">
          {ann.replies.map((reply) => (
            <ReplyItem
              key={reply.id}
              reply={reply}
              onDelete={() => handleDeleteReply(reply.id)}
            />
          ))}
        </div>
      )}

      {/* Reply input */}
      <div className="mt-2" onClick={(e) => e.stopPropagation()}>
        {showReply ? (
          <div className="space-y-1">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="添加评论（支持完整 Markdown）"
              className="w-full text-xs border border-gray-200 rounded p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              rows={3}
            />
            <div className="flex gap-1 justify-end">
              <button
                onClick={() => {
                  setShowReply(false)
                  setReplyText("")
                }}
                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 rounded border border-gray-200 hover:bg-gray-50">
                取消
              </button>
              <button
                onClick={handleAddReply}
                disabled={!replyText.trim()}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                发送
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowReply(true)}
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline">
            💬 添加评论
          </button>
        )}
      </div>
    </div>
  )
}

export default function SidePanel() {
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
  const listRef = useRef<HTMLDivElement>(null)

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
            // Content script not available, keep current order
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
        const isBookmarked = await storage.isBookmarked(tab.url)
        setBookmarked(isBookmarked)
        const bookmarks = await storage.getBookmarks()
        const bm = bookmarks.find((b) => b.url === tab.url)
        setBookmarkTime(bm?.createdAt || null)
        const color = await storage.getHighlightColor()
        setHighlightColor(color.bg)
        await fetchPositionsAndSort(data, order.length > 0 ? order : null)
      }
    } catch (e) {
      console.error("[SidePanel] load error:", e)
    }
  }

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
        if (newAnns) {
          setAnnotations(newAnns)
          fetchPositionsAndSort(newAnns, customOrder)
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

    // Listen for highlight clicks from content script
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
    await storage.deleteAnnotation(url, id)
    setAnnotations((prev) => {
      const next = prev.filter((a) => a.id !== id)
      setDisplayAnnotations(next)
      return next
    })
    // Also update custom order
    if (customOrder) {
      const nextOrder = customOrder.filter((oid) => oid !== id)
      setCustomOrder(nextOrder.length > 0 ? nextOrder : null)
      await storage.saveAnnotationOrder(url, nextOrder)
    }
  }, [url, customOrder])

  const handleReplyAdded = useCallback((annId: string, reply: Reply) => {
    const updater = (prev: Annotation[]) =>
      prev.map((a) =>
        a.id === annId ? { ...a, replies: [...(a.replies || []), reply] } : a
      )
    setAnnotations(updater)
    setDisplayAnnotations(updater)
  }, [])

  const handleReplyDeleted = useCallback((annId: string, replyId: string) => {
    const updater = (prev: Annotation[]) =>
      prev.map((a) =>
        a.id === annId
          ? { ...a, replies: (a.replies || []).filter((r) => r.id !== replyId) }
          : a
      )
    setAnnotations(updater)
    setDisplayAnnotations(updater)
  }, [])

  const handleAddAnnotation = async () => {
    if (!newContent.trim() || !url) return
    const annotation: Annotation = {
      id: crypto.randomUUID(),
      url,
      data: { type: "comment", content: newContent.trim() },
      author: { id: "local-user", name: "Me" },
      visibility: "private",
      createdAt: new Date().toISOString()
    }
    await storage.saveAnnotation(annotation)
    const next = [...annotations, annotation]
    setAnnotations(next)
    setNewContent("")
    setShowAddForm(false)
    // Re-sort with positions
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
    // Notify content scripts to refresh
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
          <h1 className="text-base font-semibold text-gray-800 truncate">{title || "未命名页面"}</h1>
          <p className="text-[10px] text-gray-400 truncate">{url.replace(/^https?:\/\//, "") || "未选择页面"}</p>
        </div>
        <div className="flex flex-col items-end ml-2">
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
            title={bookmarked ? "取消收藏" : "收藏此页面"}>
            {bookmarked ? "⭐" : "☆"}
          </button>
          {bookmarkTime && (
            <span className="text-[9px] text-gray-400 mt-0.5">
              {new Date(bookmarkTime).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Color picker */}
      <div className="px-4 py-1.5 border-b border-gray-100 shrink-0 flex items-center gap-2">
        <span className="text-[10px] text-gray-400">高亮颜色:</span>
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

      {/* Add annotation button */}
      <div className="px-4 py-2 border-b border-gray-100 shrink-0">
        {showAddForm ? (
          <div className="space-y-1">
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="写下你对这个网页的批注（支持完整 Markdown）"
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
                取消
              </button>
              <button
                onClick={handleAddAnnotation}
                disabled={!newContent.trim()}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                保存
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
            + 添加批注
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-gray-100 shrink-0">
        <span className="text-[10px] text-gray-400">
          {customOrder ? "自定义排序" : "按页面位置排序"}
        </span>
        {customOrder && (
          <button
            onClick={handleResetOrder}
            className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline">
            重置为页面顺序
          </button>
        )}
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {displayAnnotations.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-8">
            {url ? "暂无批注，点击上方按钮添加" : "请在浏览器中选择标签页"}
          </div>
        )}
        {displayAnnotations.map((ann) => (
          <AnnotationCard
            key={ann.id}
            ann={ann}
            url={url}
            onDelete={handleDelete}
            onReplyAdded={handleReplyAdded}
            onReplyDeleted={handleReplyDeleted}
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
      <div className="px-4 py-2 border-t border-gray-100 text-[10px] text-gray-400 text-center shrink-0">
        本页共 {displayAnnotations.length} 条批注
      </div>
    </div>
  )
}

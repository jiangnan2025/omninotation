import { useCallback, useEffect, useRef, useState } from "react"
import "katex/dist/katex.min.css"
import "./style.css"

import * as storage from "@/services/storage"
import type { Annotation, Reply, Group, Visibility } from "@/types"
import { AnnotationCard } from "@/components/AnnotationCard"
import { GroupManager } from "@/components/GroupManager"

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
  const [groups, setGroups] = useState<Group[]>([])
  const [showGroupManager, setShowGroupManager] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [pendingEditIds, setPendingEditIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")
  const [bookmarkTags, setBookmarkTags] = useState<string[]>([])
  const [showTagInput, setShowTagInput] = useState(false)
  const [tagInput, setTagInput] = useState("")
  const listRef = useRef<HTMLDivElement>(null)

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
        const gs = await storage.getGroups()
        setGroups(gs)
        const bookmarks = await storage.getBookmarks()
        const currentBm = bookmarks.find((b) => b.url === tab.url)
        setBookmarked(!!currentBm)
        setBookmarkTime(currentBm?.createdAt || null)
        setBookmarkTags(currentBm?.tags || [])
        setPageVisibility(currentBm?.visibility || "private")
        setPageGroupId(currentBm?.groupId)
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
          // Auto-edit empty annotations from context menu
          const emptyIds = newAnns
            .filter((a) => a.data.content === "" && !pendingEditIds.has(a.id))
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
    await storage.deleteAnnotation(url, id)
    setAnnotations((prev) => {
      const next = prev.filter((a) => a.id !== id)
      setDisplayAnnotations(next)
      return next
    })
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

  const [pageVisibility, setPageVisibility] = useState<Visibility>("private")
  const [pageGroupId, setPageGroupId] = useState<string | undefined>(undefined)

  const handleVisibilityChange = useCallback(async (visibility: Visibility, groupId?: string) => {
    await storage.updateBookmarkVisibility(url, visibility, groupId)
    setPageVisibility(visibility)
    setPageGroupId(groupId)
  }, [url])

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
        alert("无法与页面通信，请刷新后重试")
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

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return
    const group: Group = {
      id: crypto.randomUUID(),
      name: newGroupName.trim(),
      members: [{ id: "local-user", name: "Me" }],
      createdAt: new Date().toISOString()
    }
    await storage.saveGroup(group)
    setGroups((prev) => [...prev, group])
    setNewGroupName("")
  }

  const handleDeleteGroup = async (id: string) => {
    await storage.deleteGroup(id)
    setGroups((prev) => prev.filter((g) => g.id !== id))
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
        alert("文件格式错误：不是有效的 JSON 对象")
        return
      }
      if (!confirm("导入将覆盖当前所有数据，确定继续？")) return
      await storage.importAllData(data)
      alert("导入成功！")
      load()
    } catch (e) {
      alert("导入失败：" + (e instanceof Error ? e.message : String(e)))
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
          <h1 className="text-base font-semibold text-gray-800 truncate">{title || "未命名页面"}</h1>
          <p className="text-[10px] text-gray-400 truncate">
            {(() => { try { return decodeURIComponent(url).replace(/^https?:\/\//, "") } catch { return url.replace(/^https?:\/\//, "") } })() || "未选择页面"}
          </p>
        </div>
        <div className="flex flex-col items-end ml-2 gap-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => chrome.runtime.openOptionsPage()}
              className="text-xs text-gray-400 hover:text-blue-600"
              title="打开仪表盘">
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
              title={bookmarked ? "取消收藏" : "收藏此页面"}>
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
                placeholder="标签"
                autoFocus
                className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 w-20 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={handleBookmarkTagAdd}
                disabled={!tagInput.trim()}
                className="text-[10px] text-blue-600 hover:text-blue-800 disabled:text-gray-300">
                保存
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowTagInput(true)}
              className="text-[10px] text-gray-400 hover:text-blue-600 px-1 py-0.5 rounded border border-dashed border-gray-300 hover:border-blue-300">
              ＋ 标签
            </button>
          )}
        </div>
      </div>

      {/* Page visibility */}
      <div className="px-4 py-1.5 border-b border-gray-100 shrink-0 flex items-center gap-2">
        <span className="text-[10px] text-gray-400">页面权限:</span>
        <select
          value={pageVisibility}
          onChange={(e) => {
            const v = e.target.value as Visibility
            if (v === "group") {
              const firstGroup = groups[0]?.id
              handleVisibilityChange(v, firstGroup)
            } else {
              handleVisibilityChange(v)
            }
          }}
          className="text-[10px] border border-gray-200 rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="private">🔒 仅自己</option>
          <option value="public">🌐 公开</option>
          <option value="group">👥 群组</option>
        </select>
        {pageVisibility === "group" && (
          <select
            value={pageGroupId || ""}
            onChange={(e) => handleVisibilityChange("group", e.target.value || undefined)}
            className="text-[10px] border border-gray-200 rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">选择群组...</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        )}
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

      {/* Group manager */}
      <GroupManager
        groups={groups}
        show={showGroupManager}
        onToggle={() => setShowGroupManager((v) => !v)}
        newGroupName={newGroupName}
        onNewGroupNameChange={setNewGroupName}
        onCreate={handleCreateGroup}
        onDelete={handleDeleteGroup}
      />

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
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddForm(true)}
              className="flex-1 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
              + 添加批注
            </button>
            <button
              onClick={handleAddSticky}
              className="px-3 py-1.5 text-xs bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors"
              title="在页面任意位置添加便签">
              📌 便签
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
          placeholder="搜索批注内容、引用或评论..."
          className="w-full text-[11px] border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* List */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-gray-100 shrink-0">
        <span className="text-[10px] text-gray-400">
          {searchQuery.trim()
            ? `找到 ${displayAnnotations.filter((a) => matchesSearch(a, searchQuery)).length} 条结果`
            : customOrder ? "自定义排序" : "按页面位置排序"}
        </span>
        {customOrder && !searchQuery.trim() && (
          <button
            onClick={handleResetOrder}
            className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline">
            重置为页面顺序
          </button>
        )}
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {displayAnnotations.filter((a) => matchesSearch(a, searchQuery)).length === 0 && (
          <div className="text-center text-gray-400 text-sm py-8">
            {url
              ? searchQuery.trim()
                ? "无匹配结果"
                : "暂无批注，点击上方按钮添加"
              : "请在浏览器中选择标签页"}
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
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-400">
            本页共 {displayAnnotations.length} 条批注
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="text-[10px] text-gray-500 hover:text-blue-600 hover:underline">
              📤 导出
            </button>
            <label className="text-[10px] text-gray-500 hover:text-blue-600 hover:underline cursor-pointer">
              📥 导入
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

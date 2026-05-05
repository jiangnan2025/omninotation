import { useEffect, useState } from "react"
import * as storage from "@/services/storage"
import type { Annotation, Reply } from "@/types"
import { MarkdownContent } from "./MarkdownContent"
import { ReplyThread } from "./ReplyThread"

export function AnnotationCard({
  ann,
  url,
  onDelete,
  onReplyAdded,
  onReplyDeleted,
  onReplyEdited,
  onNestedReplyAdded,
  onEdit,
  onStatusToggle,
  autoEdit,
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
  onReplyEdited: (annId: string, replyId: string, content: string) => void
  onNestedReplyAdded: (annId: string, parentReplyId: string, reply: Reply) => void
  onEdit: (annId: string, content: string) => void
  onStatusToggle: (annId: string) => void
  autoEdit?: boolean
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
  const [isEditing, setIsEditing] = useState(autoEdit || false)
  const [editText, setEditText] = useState(ann.data.content)

  useEffect(() => {
    if (autoEdit) {
      setIsEditing(true)
    }
  }, [autoEdit])

  const handleAddReply = async () => {
    if (!replyText.trim() || !url) return
    const reply: Reply = {
      id: crypto.randomUUID(),
      content: replyText.trim(),
      author: { id: "local-user", name: "Me" },
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

  const handleEditReply = async (replyId: string, content: string) => {
    if (!url) return
    await storage.updateReplyContent(url, ann.id, replyId, content)
    onReplyEdited(ann.id, replyId, content)
  }

  const handleNestedReply = async (parentReplyId: string, content: string) => {
    if (!url) return
    const reply: Reply = {
      id: crypto.randomUUID(),
      content,
      author: { id: "local-user", name: "Me" },
      parentId: parentReplyId,
      createdAt: new Date().toISOString()
    }
    await storage.addNestedReply(url, ann.id, parentReplyId, reply)
    onNestedReplyAdded(ann.id, parentReplyId, reply)
  }

  const handleSaveEdit = () => {
    const trimmed = editText.trim()
    if (trimmed && trimmed !== ann.data.content) {
      onEdit(ann.id, trimmed)
    }
    setIsEditing(false)
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
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
            {ann.position ? "📌 便签" : ann.data.markStyle === "underline" ? "U̲ 下划线" : ann.data.markStyle === "strikethrough" ? "S̶ 删除" : ann.data.markStyle === "squiggly" ? "〰 波浪" : "▌ 高亮"}
          </span>
          {ann.status === "resolved" && (
            <span className="text-[10px] px-1 py-0.5 rounded bg-green-100 text-green-700">
              ✓ 已解决
            </span>
          )}
          <span className="text-[10px] text-gray-400">
            {new Date(ann.createdAt).toLocaleString()}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onStatusToggle(ann.id)
            }}
            title={ann.status === "resolved" ? "标记为待处理" : "标记为已解决"}
            className={`text-xs hover:underline ${ann.status === "resolved" ? "text-green-500 hover:text-green-700" : "text-gray-400 hover:text-gray-600"}`}>
            {ann.status === "resolved" ? "↩ 撤销" : "✓ 解决"}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsEditing(true)
            }}
            className="text-xs text-gray-500 hover:text-gray-700 hover:underline">
            编辑
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(ann.id)
            }}
            className="text-xs text-red-500 hover:text-red-700 hover:underline">
            删除
          </button>
        </div>
      </div>

      {/* Quote (if has selected text) */}
      {ann.quote && (
        <p className="text-xs text-gray-500 mb-2 line-clamp-2 italic">"{ann.quote}"</p>
      )}

      {/* Content */}
      <div className="mb-2" onClick={(e) => e.stopPropagation()}>
        {isEditing ? (
          <div className="space-y-1">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              rows={3}
              autoFocus
            />
            <div className="flex gap-1 justify-end">
              <button
                onClick={() => { setIsEditing(false); setEditText(ann.data.content) }}
                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 rounded border border-gray-200 hover:bg-gray-50">
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!editText.trim()}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                保存
              </button>
            </div>
          </div>
        ) : (
          <MarkdownContent text={ann.data.content} />
        )}
      </div>

      {/* Replies */}
      {ann.replies && ann.replies.length > 0 && (
        <div className="mt-2 space-y-2 border-t border-gray-200 pt-2">
          {ann.replies.map((reply) => (
            <ReplyThread
              key={reply.id}
              reply={reply}
              onDelete={(id) => handleDeleteReply(id)}
              onEdit={(id, content) => handleEditReply(id, content)}
              onReply={(id, content) => handleNestedReply(id, content)}
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

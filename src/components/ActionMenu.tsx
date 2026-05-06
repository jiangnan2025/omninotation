import { useCallback, useEffect, useRef, useState } from "react"

import * as anchor from "@/services/anchor"
import { getDomainConfig } from "@/services/config"
import { rangeToMarkdown } from "@/services/htmlToMarkdown"
import * as storage from "@/services/storage"
import type { MarkStyle } from "@/types"

export interface SelectionInfo {
  text: string
  range: Range
  rect: DOMRect
}

const MARK_STYLES: { key: MarkStyle; label: string; icon: string }[] = [
  { key: "highlight", label: "高亮", icon: "▌" },
  { key: "underline", label: "下划线", icon: "U̲" },
  { key: "strikethrough", label: "删除线", icon: "S̶" },
  { key: "squiggly", label: "波浪线", icon: "〰" }
]

export function ActionMenu({
  selection,
  defaultMarkStyle = "highlight",
  onClose
}: {
  selection: SelectionInfo | null
  defaultMarkStyle?: MarkStyle
  onClose: () => void
}) {
  const formType = "comment"
  const [content, setContent] = useState("")
  const [markStyle, setMarkStyle] = useState<MarkStyle>(defaultMarkStyle)
  const [authorName, setAuthorName] = useState("Me")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (selection) {
      setContent("")
      setMarkStyle(defaultMarkStyle)
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [selection, defaultMarkStyle])

  const handleSave = useCallback(async () => {
    if (!selection) return

    // Convert selected HTML to markdown to preserve formatting
    const selectedMarkdown = rangeToMarkdown(selection.range) || selection.text
    if (!content.trim() && !selectedMarkdown) return

    const config = getDomainConfig(location.href)
    const root = anchor.getRootElement(config.rootSelector)
    const selector = anchor.describeRange(root, selection.range)
    if (!selector) {
      alert("定位失败，请尝试选择更多上下文。")
      return
    }

    // quote = markdown formatted selected text; content = user's comment
    await storage.saveAnnotation({
      id: crypto.randomUUID(),
      url: location.href,
      selector,
      quote: selectedMarkdown.slice(0, 2000),
      data: { type: formType, content: content.trim(), markStyle },
      author: { id: "local-user", name: authorName },
      createdAt: new Date().toISOString()
    })

    setContent("")
    console.log("[ActionMenu] handleSave calling onClose")
    onClose()
  }, [selection, content, markStyle, authorName, onClose])

  if (!selection) return null

  const pos = {
    x: selection.rect.left,
    y: selection.rect.top - 48
  }

  return (
    <>
      {/* Backdrop: click outside to close */}
      <div
        className="fixed inset-0"
        style={{ zIndex: 2147483646 }}
        onClick={onClose}
      />
      <div
        className="fixed z-[2147483647] flex flex-col gap-2"
        style={{
          left: Math.max(8, Math.min(pos.x, window.innerWidth - 320)),
          top: Math.max(8, pos.y)
        }}>
        <div data-omninotation-menu className="bg-white rounded-lg shadow-xl border border-gray-200 p-3 w-72 pointer-events-auto">
        <div className="text-[10px] text-gray-400 mb-1">支持 Markdown 格式</div>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={formType === "comment" ? "添加批注..." : "提议修改..."}
          className="w-full text-sm border border-gray-200 rounded p-2 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows={3}
        />
        {/* Mark style selector */}
        <div className="flex gap-1 mb-2">
          {MARK_STYLES.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setMarkStyle(key)}
              title={label}
              className={`flex-1 text-xs py-1 rounded border transition-colors ${
                markStyle === key
                  ? "bg-blue-50 border-blue-300 text-blue-700"
                  : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}>
              {icon}
            </button>
          ))}
        </div>
        <div className="flex justify-between items-center">
          <input
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-1 w-24 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="名称"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { console.log("[ActionMenu] cancel button calling onClose"); onClose() }}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={!content.trim() && !selection.text.trim()}
              className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
              保存
            </button>
          </div>
        </div>
        </div>
      </div>
    </>
  )
}

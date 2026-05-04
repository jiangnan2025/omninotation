import { useCallback, useEffect, useState } from "react"

import { useTextSelection } from "@/hooks/useTextSelection"
import * as anchor from "@/services/anchor"
import { getDomainConfig } from "@/services/config"
import * as storage from "@/services/storage"


export function ActionMenu() {
  const { selection, clearSelection } = useTextSelection()
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const formType = "comment"
  const [content, setContent] = useState("")
  const [authorName, setAuthorName] = useState("Me")

  useEffect(() => {
    if (selection) {
      const rect = selection.rect
      setPos({
        x: rect.left,
        y: rect.top - 48
      })
    } else {
      setPos(null)
    }
  }, [selection])

  useEffect(() => {
    if (!pos) return
    const handleClickOutside = (e: MouseEvent) => {
      const path = e.composedPath()
      const isInsideMenu = path.some(
        (el) => el instanceof HTMLElement && el.hasAttribute("data-omninotation-menu")
      )
      if (isInsideMenu) return
      const sel = window.getSelection()
      if (sel && !sel.isCollapsed) return // 用户正在选中文本，不关闭
      setPos(null)
      clearSelection()
    }
    document.addEventListener("click", handleClickOutside)
    return () => document.removeEventListener("click", handleClickOutside)
  }, [pos, clearSelection])

  const handleSave = useCallback(async () => {
    if (!selection || !content.trim()) return

    const config = getDomainConfig(location.href)
    const root = anchor.getRootElement(config.rootSelector)
    const selector = anchor.describeRange(root, selection.range)
    if (!selector) {
      alert("定位失败，请尝试选择更多上下文。")
      return
    }

    await storage.saveAnnotation({
      id: crypto.randomUUID(),
      url: location.href,
      selector,
      quote: selection.text.slice(0, 200),
      data: { type: formType, content: content.trim() },
      author: { id: "local-user", name: authorName },
      visibility: "private",
      createdAt: new Date().toISOString()
    })

    setContent("")
    clearSelection()
    setPos(null)
  }, [selection, content, formType, authorName, clearSelection])

  if (!pos || !selection) return null

  return (
    <div
      className="fixed z-[2147483647] flex flex-col gap-2 pointer-events-none"
      style={{
        left: Math.max(8, Math.min(pos.x, window.innerWidth - 320)),
        top: Math.max(8, pos.y)
      }}>
      <div data-omninotation-menu className="bg-white rounded-lg shadow-xl border border-gray-200 p-3 w-72 pointer-events-auto">
        <div className="text-[10px] text-gray-400 mb-1">支持 Markdown 格式</div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={formType === "comment" ? "添加批注..." : "提议修改..."}
          className="w-full text-sm border border-gray-200 rounded p-2 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows={3}
          autoFocus
        />
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
              onClick={() => {
                clearSelection()
                setPos(null)
              }}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={!content.trim()}
              className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

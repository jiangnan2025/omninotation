import { useState } from "react"
import type { Annotation } from "@/types"
import { MarkdownContent } from "./MarkdownContent"

interface SidebarProps {
  annotations: Annotation[]
  onDelete: (id: string) => void
  onClose: () => void
}

export function Sidebar({ annotations, onDelete, onClose }: SidebarProps) {
  const [filter, setFilter] = useState<"all" | "comment" | "edit">("all")

  const filtered =
    filter === "all" ? annotations : annotations.filter((a) => a.data.type === filter)

  return (
    <div
      className="flex flex-col h-full w-80 bg-white border-l border-gray-200 shadow-xl pointer-events-auto"
      style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-800">OmniNotation</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-lg leading-none"
          aria-label="关闭侧边栏">
          ×
        </button>
      </div>

      <div className="flex gap-2 px-4 py-2 border-b border-gray-100">
        {(["all", "comment", "edit"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              filter === f
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}>
            {f === "all" ? "全部" : f === "comment" ? "批注" : "修改"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filtered.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-8">暂无批注</div>
        )}
        {filtered.map((ann) => (
          <div
            key={ann.id}
            className="rounded-lg border border-gray-100 bg-gray-50 p-3 hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between mb-1">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  ann.data.type === "edit"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-blue-100 text-blue-700"
                }`}>
                {ann.data.type === "comment" ? "批注" : "修改"}
              </span>
              <span className="text-[10px] text-gray-400">{ann.author.name}</span>
            </div>
            {/* Quote rendered as markdown with copy button */}
            {ann.quote && (
              <div className="mb-2">
                <div className="relative group">
                  <div className="quote-content max-h-40 overflow-y-auto">
                    <MarkdownContent text={ann.quote} />
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(ann.quote || "").catch(() => {})
                    }}
                    className="absolute top-0 right-0 text-[10px] text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity px-1 py-0.5 bg-white/80 rounded"
                    title="复制">
                    📋
                  </button>
                </div>
              </div>
            )}
            <div className="flex justify-end mt-2">
              <button
                onClick={() => onDelete(ann.id)}
                className="text-xs text-red-500 hover:text-red-700 hover:underline">
                删除
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-2 border-t border-gray-100 text-[10px] text-gray-400 text-center">
        本页共 {annotations.length} 条批注
      </div>
    </div>
  )
}
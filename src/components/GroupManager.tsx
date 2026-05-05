import type { Group } from "@/types"

export function GroupManager({
  groups,
  show,
  onToggle,
  newGroupName,
  onNewGroupNameChange,
  onCreate,
  onDelete
}: {
  groups: Group[]
  show: boolean
  onToggle: () => void
  newGroupName: string
  onNewGroupNameChange: (value: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="px-4 py-1.5 border-b border-gray-100 shrink-0">
      <button
        onClick={onToggle}
        className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700">
        <span>{show ? "▼" : "▶"}</span>
        <span>群组管理 ({groups.length})</span>
      </button>
      {show && (
        <div className="mt-2 space-y-2">
          {groups.length === 0 && (
            <p className="text-[10px] text-gray-400">暂无群组</p>
          )}
          {groups.map((g) => (
            <div key={g.id} className="flex items-center justify-between bg-gray-50 rounded px-2 py-1">
              <span className="text-[11px] text-gray-700 truncate">{g.name}</span>
              <button
                onClick={() => onDelete(g.id)}
                className="text-[10px] text-red-400 hover:text-red-600 ml-2">
                删除
              </button>
            </div>
          ))}
          <div className="flex gap-1">
            <input
              value={newGroupName}
              onChange={(e) => onNewGroupNameChange(e.target.value)}
              placeholder="新群组名称"
              className="flex-1 text-[11px] border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={onCreate}
              disabled={!newGroupName.trim()}
              className="px-2 py-1 text-[11px] bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              创建
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

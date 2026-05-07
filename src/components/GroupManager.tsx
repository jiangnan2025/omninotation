import type { Group } from "@/types"
import { detectLocale, t, type Locale } from "@/services/i18n"

export function GroupManager({
  groups,
  show,
  onToggle,
  newGroupName,
  onNewGroupNameChange,
  onCreate,
  onDelete,
  locale: localeProp
}: {
  groups: Group[]
  show: boolean
  onToggle: () => void
  newGroupName: string
  onNewGroupNameChange: (value: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
  locale?: Locale
}) {
  const locale = localeProp || detectLocale()
  const L = t(locale)

  return (
    <div className="px-4 py-1.5 border-b border-gray-100 shrink-0">
      <button
        onClick={onToggle}
        className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700">
        <span>{show ? "▼" : "▶"}</span>
        <span>{L.groupManagement(groups.length)}</span>
      </button>
      {show && (
        <div className="mt-2 space-y-2">
          {groups.length === 0 && (
            <p className="text-[10px] text-gray-400">{L.noGroups}</p>
          )}
          {groups.map((g) => (
            <div key={g.id} className="flex items-center justify-between bg-gray-50 rounded px-2 py-1">
              <span className="text-[11px] text-gray-700 truncate">{g.name}</span>
              <button
                onClick={() => onDelete(g.id)}
                className="text-[10px] text-red-400 hover:text-red-600 ml-2">
                {L.delete}
              </button>
            </div>
          ))}
          <div className="flex gap-1">
            <input
              value={newGroupName}
              onChange={(e) => onNewGroupNameChange(e.target.value)}
              placeholder={L.newGroupNamePlaceholder}
              className="flex-1 text-[11px] border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={onCreate}
              disabled={!newGroupName.trim()}
              className="px-2 py-1 text-[11px] bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {L.create}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
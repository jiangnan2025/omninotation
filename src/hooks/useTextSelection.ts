import { useCallback, useEffect, useState } from "react"

export interface SelectionInfo {
  text: string
  range: Range
  rect: DOMRect
}

export function useTextSelection() {
  const [selection, setSelection] = useState<SelectionInfo | null>(null)

  const handleSelectionChange = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setSelection(null)
      return
    }
    const range = sel.getRangeAt(0)
    const text = sel.toString().trim()
    if (!text) {
      setSelection(null)
      return
    }
    const rect = range.getBoundingClientRect()
    setSelection({ text, range, rect })
  }, [])

  const clearSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges()
    setSelection(null)
  }, [])

  useEffect(() => {
    document.addEventListener("selectionchange", handleSelectionChange)
    document.addEventListener("mouseup", handleSelectionChange)
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange)
      document.removeEventListener("mouseup", handleSelectionChange)
    }
  }, [handleSelectionChange])

  return { selection, clearSelection }
}

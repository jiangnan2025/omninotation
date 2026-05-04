import type { Annotation, Bookmark } from "@/types"

const ANNOTATION_KEY_PREFIX = "annotations:"

export function getKey(url: string): string {
  return ANNOTATION_KEY_PREFIX + url
}

function safeGet(keys: string | string[]): Promise<Record<string, any>> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          const msg = chrome.runtime.lastError.message || ""
          if (msg.includes("Extension context invalidated")) {
            console.warn("[OmniNotation] 扩展已重新加载，请刷新页面。")
          } else {
            console.warn("[OmniNotation] storage get error:", msg)
          }
          resolve({})
        } else {
          resolve(result)
        }
      })
    } catch (e) {
      console.warn("[OmniNotation] storage get exception:", e)
      resolve({})
    }
  })
}

function safeSet(items: Record<string, any>): Promise<void> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set(items, () => {
        if (chrome.runtime.lastError) {
          const msg = chrome.runtime.lastError.message || ""
          if (msg.includes("Extension context invalidated")) {
            console.warn("[OmniNotation] 扩展已重新加载，请刷新页面。")
          } else {
            console.warn("[OmniNotation] storage set error:", msg)
          }
        }
        resolve()
      })
    } catch (e) {
      console.warn("[OmniNotation] storage set exception:", e)
      resolve()
    }
  })
}

function safeRemove(keys: string | string[]): Promise<void> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.remove(keys, () => {
        if (chrome.runtime.lastError) {
          const msg = chrome.runtime.lastError.message || ""
          if (msg.includes("Extension context invalidated")) {
            console.warn("[OmniNotation] 扩展已重新加载，请刷新页面。")
          } else {
            console.warn("[OmniNotation] storage remove error:", msg)
          }
        }
        resolve()
      })
    } catch (e) {
      console.warn("[OmniNotation] storage remove exception:", e)
      resolve()
    }
  })
}

export async function getAnnotations(url: string): Promise<Annotation[]> {
  const key = getKey(url)
  const result = await safeGet(key)
  return result[key] ?? []
}

export async function saveAnnotation(annotation: Annotation): Promise<void> {
  const key = getKey(annotation.url)
  const existing = await getAnnotations(annotation.url)
  const index = existing.findIndex((a) => a.id === annotation.id)
  if (index >= 0) {
    existing[index] = annotation
  } else {
    existing.push(annotation)
  }
  await safeSet({ [key]: existing })
}

export async function deleteAnnotation(url: string, id: string): Promise<void> {
  const key = getKey(url)
  const existing = await getAnnotations(url)
  const filtered = existing.filter((a) => a.id !== id)
  await safeSet({ [key]: filtered })
}

export async function addReply(url: string, annotationId: string, reply: Reply): Promise<void> {
  const key = getKey(url)
  const annotations = await getAnnotations(url)
  const ann = annotations.find((a) => a.id === annotationId)
  if (!ann) return
  if (!ann.replies) ann.replies = []
  ann.replies.push(reply)
  await safeSet({ [key]: annotations })
}

export async function deleteReply(url: string, annotationId: string, replyId: string): Promise<void> {
  const key = getKey(url)
  const annotations = await getAnnotations(url)
  const ann = annotations.find((a) => a.id === annotationId)
  if (!ann || !ann.replies) return
  ann.replies = ann.replies.filter((r) => r.id !== replyId)
  await safeSet({ [key]: annotations })
}

export async function clearAnnotations(url: string): Promise<void> {
  const key = getKey(url)
  await safeRemove(key)
}

const ANNOTATION_ORDER_PREFIX = "annotation_order:"

export function getOrderKey(url: string): string {
  return ANNOTATION_ORDER_PREFIX + url
}

export async function getAnnotationOrder(url: string): Promise<string[]> {
  const key = getOrderKey(url)
  const result = await safeGet(key)
  return result[key] ?? []
}

export async function saveAnnotationOrder(url: string, order: string[]): Promise<void> {
  const key = getOrderKey(url)
  await safeSet({ [key]: order })
}

const HIGHLIGHT_COLOR_KEY = "highlight_color"

export interface HighlightColor {
  bg: string
  hover: string
}

export async function getHighlightColor(): Promise<HighlightColor> {
  const result = await safeGet(HIGHLIGHT_COLOR_KEY)
  return result[HIGHLIGHT_COLOR_KEY] ?? {
    bg: "rgba(250, 204, 21, 0.3)",
    hover: "rgba(250, 204, 21, 0.6)"
  }
}

export async function setHighlightColor(color: HighlightColor): Promise<void> {
  await safeSet({ [HIGHLIGHT_COLOR_KEY]: color })
}

const BOOKMARKS_KEY = "bookmarks"

export async function getBookmarks(): Promise<Bookmark[]> {
  const result = await safeGet(BOOKMARKS_KEY)
  return result[BOOKMARKS_KEY] ?? []
}

export async function isBookmarked(url: string): Promise<boolean> {
  const bookmarks = await getBookmarks()
  return bookmarks.some((b) => b.url === url)
}

export async function addBookmark(bookmark: Bookmark): Promise<void> {
  const bookmarks = await getBookmarks()
  if (bookmarks.some((b) => b.url === bookmark.url)) return
  bookmarks.unshift(bookmark)
  await safeSet({ [BOOKMARKS_KEY]: bookmarks })
}

export async function removeBookmark(url: string): Promise<void> {
  const bookmarks = await getBookmarks()
  const filtered = bookmarks.filter((b) => b.url !== url)
  await safeSet({ [BOOKMARKS_KEY]: filtered })
}

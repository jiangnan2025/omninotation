import type { Annotation, AnnotationEntry, Bookmark, BookmarkFolder, Group, UserProfile, Reply, Visibility, ToolbarConfig, ToolbarSearchEngine, ToolbarStyle } from "@/types"

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
  // Auto-bookmark if not already bookmarked
  const bookmarked = await isBookmarked(annotation.url)
  if (!bookmarked) {
    await addBookmark({
      id: crypto.randomUUID(),
      url: annotation.url,
      title: annotation.title || annotation.url,
      visibility: "private",
      createdAt: new Date().toISOString()
    })
  }
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

function findReplyRecursive(replies: Reply[], replyId: string): Reply | undefined {
  for (const r of replies) {
    if (r.id === replyId) return r
    if (r.replies) {
      const found = findReplyRecursive(r.replies, replyId)
      if (found) return found
    }
  }
  return undefined
}

function deleteReplyRecursive(replies: Reply[], replyId: string): boolean {
  const index = replies.findIndex((r) => r.id === replyId)
  if (index >= 0) {
    replies.splice(index, 1)
    return true
  }
  for (const r of replies) {
    if (r.replies && deleteReplyRecursive(r.replies, replyId)) {
      return true
    }
  }
  return false
}

function updateReplyRecursive(replies: Reply[], replyId: string, content: string): boolean {
  const reply = replies.find((r) => r.id === replyId)
  if (reply) {
    reply.content = content
    return true
  }
  for (const r of replies) {
    if (r.replies && updateReplyRecursive(r.replies, replyId, content)) {
      return true
    }
  }
  return false
}

export async function deleteReply(url: string, annotationId: string, replyId: string): Promise<void> {
  const key = getKey(url)
  const annotations = await getAnnotations(url)
  const ann = annotations.find((a) => a.id === annotationId)
  if (!ann || !ann.replies) return
  deleteReplyRecursive(ann.replies, replyId)
  await safeSet({ [key]: annotations })
}

export async function updateAnnotationContent(url: string, annotationId: string, content: string): Promise<void> {
  const key = getKey(url)
  const annotations = await getAnnotations(url)
  const ann = annotations.find((a) => a.id === annotationId)
  if (!ann) return
  ann.data.content = content
  ann.updatedAt = new Date().toISOString()
  await safeSet({ [key]: annotations })
}

export async function updateReplyContent(url: string, annotationId: string, replyId: string, content: string): Promise<void> {
  const key = getKey(url)
  const annotations = await getAnnotations(url)
  const ann = annotations.find((a) => a.id === annotationId)
  if (!ann || !ann.replies) return
  if (!updateReplyRecursive(ann.replies, replyId, content)) return
  await safeSet({ [key]: annotations })
}

export async function updateAnnotationStatus(url: string, annotationId: string, status: "open" | "resolved"): Promise<void> {
  const key = getKey(url)
  const annotations = await getAnnotations(url)
  const ann = annotations.find((a) => a.id === annotationId)
  if (!ann) return
  ann.status = status
  await safeSet({ [key]: annotations })
}

export async function clearAnnotations(url: string): Promise<void> {
  const key = getKey(url)
  await safeRemove(key)
}

export async function updateBookmarkVisibility(url: string, visibility: Visibility, groupId?: string): Promise<void> {
  const bookmarks = await getBookmarks()
  const bm = bookmarks.find((b) => b.url === url)
  if (!bm) return
  bm.visibility = visibility
  if (groupId) bm.groupId = groupId
  else delete bm.groupId
  await safeSet({ [BOOKMARKS_KEY]: bookmarks })
}

export async function updateBookmarkTags(url: string, tags: string[]): Promise<void> {
  const bookmarks = await getBookmarks()
  const bm = bookmarks.find((b) => b.url === url)
  if (!bm) return
  bm.tags = tags
  await safeSet({ [BOOKMARKS_KEY]: bookmarks })
}

// Hierarchical replies — reply to a specific reply
export async function addNestedReply(url: string, annotationId: string, parentReplyId: string, reply: Reply): Promise<void> {
  const key = getKey(url)
  const annotations = await getAnnotations(url)
  const ann = annotations.find((a) => a.id === annotationId)
  if (!ann || !ann.replies) return
  const parent = ann.replies.find((r) => r.id === parentReplyId)
  if (!parent) return
  if (!parent.replies) parent.replies = []
  parent.replies.push(reply)
  await safeSet({ [key]: annotations })
}

// Groups
const GROUPS_KEY = "groups"

export async function getGroups(): Promise<Group[]> {
  const result = await safeGet(GROUPS_KEY)
  return result[GROUPS_KEY] ?? []
}

export async function saveGroup(group: Group): Promise<void> {
  const groups = await getGroups()
  const index = groups.findIndex((g) => g.id === group.id)
  if (index >= 0) groups[index] = group
  else groups.push(group)
  await safeSet({ [GROUPS_KEY]: groups })
}

export async function deleteGroup(id: string): Promise<void> {
  const groups = await getGroups()
  await safeSet({ [GROUPS_KEY]: groups.filter((g) => g.id !== id) })
}

// User profile
const USER_PROFILE_KEY = "user_profile"

export async function getUserProfile(): Promise<UserProfile | null> {
  const result = await safeGet(USER_PROFILE_KEY)
  return result[USER_PROFILE_KEY] ?? null
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  await safeSet({ [USER_PROFILE_KEY]: profile })
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

export async function updateBookmarkFolder(url: string, folderId: string | undefined): Promise<void> {
  const bookmarks = await getBookmarks()
  const bm = bookmarks.find((b) => b.url === url)
  if (!bm) return
  if (folderId) bm.folderId = folderId
  else delete bm.folderId
  await safeSet({ [BOOKMARKS_KEY]: bookmarks })
}

// Bookmark folders
const BOOKMARK_FOLDERS_KEY = "bookmark_folders"

export async function getBookmarkFolders(): Promise<BookmarkFolder[]> {
  const result = await safeGet(BOOKMARK_FOLDERS_KEY)
  return result[BOOKMARK_FOLDERS_KEY] ?? []
}

export async function saveBookmarkFolder(folder: BookmarkFolder): Promise<void> {
  const folders = await getBookmarkFolders()
  const index = folders.findIndex((f) => f.id === folder.id)
  if (index >= 0) folders[index] = folder
  else folders.push(folder)
  await safeSet({ [BOOKMARK_FOLDERS_KEY]: folders })
}

export async function deleteBookmarkFolder(id: string): Promise<void> {
  const folders = await getBookmarkFolders()
  const filtered = folders.filter((f) => f.id !== id)
  // Also remove folderId from bookmarks and child folders
  const bookmarks = await getBookmarks()
  bookmarks.forEach((b) => { if (b.folderId === id) delete b.folderId })
  filtered.forEach((f) => { if (f.parentId === id) delete f.parentId })
  await safeSet({ [BOOKMARK_FOLDERS_KEY]: filtered, [BOOKMARKS_KEY]: bookmarks })
}

export async function getAllAnnotations(): Promise<AnnotationEntry[]> {
  const all = await safeGet(null as any)
  const entries: AnnotationEntry[] = []
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith(ANNOTATION_KEY_PREFIX) && Array.isArray(value)) {
      const url = key.slice(ANNOTATION_KEY_PREFIX.length)
      entries.push({ url, annotations: value as Annotation[] })
    }
  }
  // Sort by most recent annotation
  entries.sort((a, b) => {
    const aTime = a.annotations[a.annotations.length - 1]?.createdAt || ""
    const bTime = b.annotations[b.annotations.length - 1]?.createdAt || ""
    return bTime.localeCompare(aTime)
  })
  return entries
}

export function searchAnnotations(
  entries: AnnotationEntry[],
  query: string
): AnnotationEntry[] {
  if (!query.trim()) return entries
  const q = query.trim().toLowerCase()

  const searchReplies = (replies: Reply[]): boolean =>
    replies.some((r) =>
      r.content.toLowerCase().includes(q) ||
      (r.replies ? searchReplies(r.replies) : false)
    )

  return entries
    .map((entry) => {
      const filtered = entry.annotations.filter((ann) => {
        return (
          ann.data.content.toLowerCase().includes(q) ||
          (ann.title?.toLowerCase().includes(q) ?? false) ||
          (ann.quote?.toLowerCase().includes(q) ?? false) ||
          (ann.replies ? searchReplies(ann.replies) : false)
        )
      })
      return filtered.length > 0 ? { ...entry, annotations: filtered } : null
    })
    .filter(Boolean) as AnnotationEntry[]
}

// Export / Import all data
export async function exportAllData(): Promise<Record<string, any>> {
  return safeGet(null as any)
}

export async function importAllData(data: Record<string, any>): Promise<void> {
  await safeSet(data)
}

// Export / Import annotations for a single page
export async function exportPageAnnotations(url: string): Promise<Record<string, any>> {
  const key = getKey(url)
  const orderKey = getOrderKey(url)
  const result = await safeGet([key, orderKey])
  const data: Record<string, any> = {}
  if (result[key]) data[key] = result[key]
  if (result[orderKey]) data[orderKey] = result[orderKey]
  return data
}

export async function importPageAnnotations(url: string, data: Record<string, any>): Promise<boolean> {
  // Try to find annotations by scanning keys or by URL matching
  const key = getKey(url)
  if (data[key]) {
    await safeSet({ [key]: data[key] })
    const orderKey = getOrderKey(url)
    if (data[orderKey]) await safeSet({ [orderKey]: data[orderKey] })
    return true
  }
  // If no exact key match, try to find any annotations:* key and import to this URL
  for (const [k, v] of Object.entries(data)) {
    if (k.startsWith(ANNOTATION_KEY_PREFIX) && Array.isArray(v)) {
      await safeSet({ [key]: v })
      return true
    }
  }
  return false
}

// ========================
// Toolbar config
// ========================

const TOOLBAR_CONFIG_KEY = "toolbar_config"

const DEFAULT_ENGINES: ToolbarSearchEngine[] = [
  {
    id: "google",
    name: "Google",
    urlTemplate: "https://www.google.com/search?q=%s",
    method: "GET",
    favicon: "🔍",
    enabled: true
  },
  {
    id: "bing",
    name: "Bing",
    urlTemplate: "https://www.bing.com/search?q=%s",
    method: "GET",
    favicon: "🅱️",
    enabled: true
  }
]

const DEFAULT_STYLE: ToolbarStyle = {
  backgroundColor: "#ffffff",
  textColor: "#374151",
  borderRadius: 8,
  padding: 4,
  buttonSize: 28,
  gap: 2,
  shadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)"
}

export function getDefaultToolbarConfig(): ToolbarConfig {
  return {
    enabled: true,
    triggerMode: "select",
    engines: DEFAULT_ENGINES,
    layout: "horizontal",
    showAnnotations: true,
    showFaviconOnly: true,
    tabOpenMode: "new-tab",
    autoClose: true,
    autoCloseDelay: 3000,
    style: DEFAULT_STYLE,
    blacklist: [],
    whitelist: []
  }
}

export async function getToolbarConfig(): Promise<ToolbarConfig> {
  const result = await safeGet(TOOLBAR_CONFIG_KEY)
  const saved = result[TOOLBAR_CONFIG_KEY] as ToolbarConfig | undefined
  if (!saved) return getDefaultToolbarConfig()
  // Merge with defaults to ensure new fields exist
  const defaults = getDefaultToolbarConfig()
  return {
    ...defaults,
    ...saved,
    style: { ...defaults.style, ...(saved.style || {}) },
    engines: saved.engines?.length ? saved.engines : defaults.engines
  }
}

export async function saveToolbarConfig(config: ToolbarConfig): Promise<void> {
  await safeSet({ [TOOLBAR_CONFIG_KEY]: config })
}

export type AnnotationType = "comment" | "edit"
export type Visibility = "private" | "friends" | "public"
export type AnchorStrategy = "text-quote" | "css-selector" | "xpath"

export interface Author {
  id: string
  name: string
}

export interface TextQuoteSelector {
  exact: string
  prefix?: string
  suffix?: string
}

export interface Reply {
  id: string
  content: string
  createdAt: string
}

export interface Annotation {
  id: string
  url: string
  selector?: TextQuoteSelector
  quote?: string
  data: {
    type: AnnotationType
    content: string
  }
  author: Author
  visibility: Visibility
  createdAt: string
  updatedAt?: string
  replies?: Reply[]
}

export interface DomainConfig {
  pattern: RegExp | string
  anchorStrategy: AnchorStrategy
  priority: number
  rootSelector?: string
}

export interface AnnotationPatch {
  url: string
  annotations: Annotation[]
}

export interface User {
  id: string
  name: string
  email?: string
}

export interface Tenant {
  id: string
  name: string
  domain: string
}

export interface Bookmark {
  id: string
  url: string
  title: string
  createdAt: string
}

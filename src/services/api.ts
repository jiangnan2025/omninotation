/**
 * FastAPI-style API client for OmniNotation backend.
 * This module defines the interface contract for multi-tenant annotation sync.
 */

import type { Annotation, Tenant, User } from "@/types"

const API_BASE_URL = process.env.PLASMO_PUBLIC_API_URL || "http://localhost:8000/api/v1"

interface ApiResponse<T> {
  data?: T
  error?: string
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    })
    if (!response.ok) {
      const text = await response.text()
      return { error: `HTTP ${response.status}: ${text}` }
    }
    const data = await response.json()
    return { data }
  } catch (err) {
    return { error: String(err) }
  }
}

// ========================
// Annotations
// ========================

export async function listAnnotations(
  url: string,
  tenantId?: string
): Promise<Annotation[]> {
  const params = new URLSearchParams({ url })
  if (tenantId) params.append("tenant_id", tenantId)
  const res = await request<Annotation[]>(`/annotations?${params.toString()}`)
  return res.data ?? []
}

export async function createAnnotation(
  annotation: Omit<Annotation, "id" | "createdAt">
): Promise<Annotation | null> {
  const res = await request<Annotation>("/annotations", {
    method: "POST",
    body: JSON.stringify(annotation)
  })
  return res.data ?? null
}

export async function updateAnnotation(
  id: string,
  patch: Partial<Annotation>
): Promise<Annotation | null> {
  const res = await request<Annotation>(`/annotations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch)
  })
  return res.data ?? null
}

export async function deleteAnnotationRemote(id: string): Promise<boolean> {
  const res = await request<void>(`/annotations/${id}`, {
    method: "DELETE"
  })
  return !res.error
}

// ========================
// Sync
// ========================

export interface SyncPayload {
  url: string
  annotations: Annotation[]
  lastSyncAt?: string
}

export async function syncAnnotations(
  payload: SyncPayload,
  tenantId?: string
): Promise<Annotation[] | null> {
  const headers: Record<string, string> = {}
  if (tenantId) headers["X-Tenant-ID"] = tenantId
  const res = await request<Annotation[]>("/sync", {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  })
  return res.data ?? null
}

// ========================
// Multi-tenant
// ========================

export async function getCurrentTenant(): Promise<Tenant | null> {
  const res = await request<Tenant>("/tenant/me")
  return res.data ?? null
}

export async function listTenants(): Promise<Tenant[]> {
  const res = await request<Tenant[]>("/tenants")
  return res.data ?? []
}

// ========================
// Auth
// ========================

export async function getCurrentUser(): Promise<User | null> {
  const res = await request<User>("/users/me")
  return res.data ?? null
}

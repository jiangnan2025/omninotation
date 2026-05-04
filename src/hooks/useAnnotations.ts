import { useCallback, useEffect, useState } from "react"
import type { Annotation } from "@/types"
import * as storage from "@/services/storage"
import * as anchor from "@/services/anchor"
import { getDomainConfig } from "@/services/config"

export interface MountedAnnotation extends Annotation {
  range: Range | null
}

export function useAnnotations(url: string) {
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [mounted, setMounted] = useState<MountedAnnotation[]>([])

  const load = useCallback(async () => {
    const data = await storage.getAnnotations(url)
    setAnnotations(data)
  }, [url])

  const mountAnnotations = useCallback(() => {
    const config = getDomainConfig(url)
    const root = anchor.getRootElement(config.rootSelector)

    const mountedList: MountedAnnotation[] = annotations.map((ann) => {
      const range = anchor.resolveRange(root, ann.selector)
      return { ...ann, range }
    })

    setMounted(mountedList)
  }, [annotations, url])

  const addAnnotation = useCallback(
    async (partial: Omit<Annotation, "id" | "createdAt" | "url">) => {
      const annotation: Annotation = {
        ...partial,
        id: crypto.randomUUID(),
        url,
        createdAt: new Date().toISOString()
      }
      await storage.saveAnnotation(annotation)
      setAnnotations((prev) => [...prev, annotation])
      return annotation
    },
    [url]
  )

  const removeAnnotation = useCallback(
    async (id: string) => {
      await storage.deleteAnnotation(url, id)
      setAnnotations((prev) => prev.filter((a) => a.id !== id))
    },
    [url]
  )

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    mountAnnotations()
  }, [mountAnnotations])

  return {
    annotations,
    mounted,
    addAnnotation,
    removeAnnotation,
    refresh: load
  }
}

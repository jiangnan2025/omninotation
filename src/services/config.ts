import type { DomainConfig } from "@/types"

const DEFAULT_CONFIGS: DomainConfig[] = [
  {
    pattern: /.*\.wikipedia\.org.*/,
    anchorStrategy: "text-quote",
    priority: 1,
    rootSelector: "#mw-content-text"
  },
  {
    pattern: /.*github\.com.*/,
    anchorStrategy: "text-quote",
    priority: 1,
    rootSelector: "[data-testid='blob-content']"
  },
  {
    pattern: ".*",
    anchorStrategy: "text-quote",
    priority: 0,
    rootSelector: "body"
  }
]

export function getDomainConfig(url: string): DomainConfig {
  for (const config of DEFAULT_CONFIGS) {
    const pattern =
      typeof config.pattern === "string" ? new RegExp(config.pattern) : config.pattern
    if (pattern.test(url)) {
      return config
    }
  }
  return DEFAULT_CONFIGS[DEFAULT_CONFIGS.length - 1]
}

export function shouldActivate(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

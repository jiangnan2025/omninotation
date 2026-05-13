import { useMemo } from "react"
import { marked } from "marked"
import katex from "katex"
import "katex/dist/katex.min.css"

function highlightInHtml(html: string, terms: string[]): string {
  const parts = html.split(/(<[^>]*>)/)
  for (let i = 0; i < parts.length; i += 2) {
    let text = parts[i]
    for (const term of terms) {
      if (!term) continue
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const regex = new RegExp(`(${escaped})`, "gi")
      text = text.replace(regex, '<mark class="omninotation-search-highlight">$1</mark>')
    }
    parts[i] = text
  }
  return parts.join("")
}

export function MarkdownContent({ text, highlightTerms }: { text: string; highlightTerms?: string[] }) {
  const html = useMemo(() => {
    const katexCache: { placeholder: string; html: string }[] = []
    let counter = 0

    // Preprocess block-level math formulas $$...$$
    let processed = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, formula) => {
      try {
        const rendered = katex.renderToString(formula.trim(), {
          throwOnError: false,
          displayMode: true
        })
        const placeholder = `{{KATEX_BLOCK_${counter++}}}`
        katexCache.push({ placeholder, html: rendered })
        return placeholder
      } catch {
        return `$$${formula}$$`
      }
    })

    // Preprocess inline math formulas $...$
    processed = processed.replace(/\$([^\$\n]+?)\$/g, (_, formula) => {
      try {
        const rendered = katex.renderToString(formula.trim(), {
          throwOnError: false,
          displayMode: false
        })
        const placeholder = `{{KATEX_INLINE_${counter++}}}`
        katexCache.push({ placeholder, html: rendered })
        return placeholder
      } catch {
        return `$${formula}$`
      }
    })

    // Parse markdown
    let renderedHtml = marked.parse(processed, { breaks: true, gfm: true }) as string

    // Restore KaTeX placeholders
    for (const { placeholder, html: katexHtml } of katexCache) {
      renderedHtml = renderedHtml.replace(placeholder, katexHtml)
    }

    // Post-process: convert video-format <img> to <video>
    renderedHtml = renderedHtml.replace(
      /<img([^>]*)src="([^"]+\.(?:mp4|webm|ogg|mov)(?:\?[^"]*)?)"([^>]*)>/gi,
      (match, _before, src, _after) => {
        const altMatch = match.match(/alt="([^"]*)"/)
        const alt = altMatch ? altMatch[1] : "Video"
        return `<video controls class="max-w-full rounded" style="max-height:300px"><source src="${src}">${alt}</video>`
      }
    )

    // Highlight search terms
    if (highlightTerms?.length) {
      renderedHtml = highlightInHtml(renderedHtml, highlightTerms)
    }

    return renderedHtml
  }, [text, highlightTerms])

  return (
    <div
      className="markdown-body text-xs text-gray-800 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

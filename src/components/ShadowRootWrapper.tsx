import ReactDOM from "react-dom/client"
import { useEffect, useRef, type ReactNode } from "react"

interface ShadowRootWrapperProps {
  children: ReactNode
  styleContent?: string
}

export function ShadowRootWrapper({ children, styleContent }: ShadowRootWrapperProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<ReactDOM.Root | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    if (!host.shadowRoot) {
      const shadow = host.attachShadow({ mode: "open" })

      if (styleContent) {
        const style = document.createElement("style")
        style.textContent = styleContent
        shadow.appendChild(style)
      }

      const container = document.createElement("div")
      container.id = "omninotation-root"
      shadow.appendChild(container)

      rootRef.current = ReactDOM.createRoot(container)
      rootRef.current.render(<>{children}</>)
    } else if (rootRef.current) {
      rootRef.current.render(<>{children}</>)
    }

    return () => {
      // We intentionally keep the shadow root alive to avoid re-mounting issues
    }
  }, [children, styleContent])

  return <div ref={hostRef} style={{ all: "initial" }} />
}

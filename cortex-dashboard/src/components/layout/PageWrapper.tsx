import { useEffect, useRef } from 'react'

interface PageWrapperProps {
  title?: string
  subtitle?: string
  children: React.ReactNode
  actions?: React.ReactNode
}

export function PageWrapper({ children, actions, title, subtitle }: PageWrapperProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.opacity = '0'
    el.style.transform = 'translateY(8px)'
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.25s ease, transform 0.25s ease'
      el.style.opacity = '1'
      el.style.transform = 'translateY(0)'
    })
  }, [])

  return (
    <div ref={ref} className="flex flex-col gap-0 page-enter">
      {(title || actions) && (
        <div className="flex items-center justify-between mb-5">
          <div>
            {title && (
              <h1 style={{
                fontFamily: "'DM Sans', system-ui, sans-serif",
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--t1)',
                lineHeight: 1,
                letterSpacing: '-0.02em',
              }}>
                {title}
              </h1>
            )}
            {subtitle && (
              <p style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13,
                color: 'var(--t3)',
                marginTop: 5,
              }}>
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

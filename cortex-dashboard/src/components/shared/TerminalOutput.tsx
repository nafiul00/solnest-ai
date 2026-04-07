import { useRef, useEffect } from 'react'

interface TerminalOutputProps {
  output: string
  isRunning?: boolean
  height?: string
  title?: string
}

export function TerminalOutput({ output, isRunning = false, height = '220px', title = 'CORTEX Terminal' }: TerminalOutputProps) {
  const ref = useRef<HTMLPreElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [output])

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2" style={{ background: '#161B22', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        </div>
        <span className="text-xs font-mono ml-2" style={{ color: '#8B949E' }}>{title}</span>
        {isRunning && (
          <span className="ml-auto text-xs font-mono flex items-center gap-1" style={{ color: '#7EE787' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#7EE787' }} />
            RUNNING
          </span>
        )}
      </div>
      <pre
        ref={ref}
        className="p-3 text-xs font-mono leading-relaxed overflow-y-auto"
        style={{
          height,
          color: '#7EE787',
          background: '#0D1117',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {output || <span style={{ color: '#4A5568' }}>Awaiting command...</span>}
        {isRunning && <span className="inline-block w-2 h-3 ml-0.5 animate-pulse" style={{ verticalAlign: 'text-bottom', background: '#7EE787' }} />}
      </pre>
    </div>
  )
}

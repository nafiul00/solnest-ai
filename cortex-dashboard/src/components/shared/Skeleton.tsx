interface SkeletonProps {
  width?: string | number
  height?: string | number
  className?: string
  rounded?: boolean
}

export function Skeleton({ width = '100%', height = 16, className = '', rounded = false }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height, borderRadius: rounded ? 9999 : 6 }}
    />
  )
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card p-4 space-y-3">
      <Skeleton height={14} width="40%" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={12} width={`${70 + Math.random() * 25}%`} />
      ))}
    </div>
  )
}

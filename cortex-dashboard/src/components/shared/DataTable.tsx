import { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

interface Column<T> {
  key: keyof T | string
  label: string
  render?: (row: T) => React.ReactNode
  sortable?: boolean
  width?: string
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[]
  data: T[]
  rowKey: keyof T
  maxHeight?: string
  emptyMessage?: string
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey,
  maxHeight = '400px',
  emptyMessage = 'No data available',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0
    const av = a[sortKey]
    const bv = b[sortKey]
    if (av === undefined || bv === undefined) return 0
    const cmp = String(av).localeCompare(String(bv))
    return sortDir === 'asc' ? cmp : -cmp
  })

  return (
    <div className="overflow-auto" style={{ maxHeight }}>
      <table className="data-table w-full border-collapse">
        <thead className="sticky top-0 z-10">
          <tr>
            {columns.map(col => (
              <th
                key={String(col.key)}
                style={{ width: col.width, textAlign: 'left', cursor: col.sortable ? 'pointer' : 'default' }}
                onClick={() => col.sortable && handleSort(String(col.key))}
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  {col.sortable && (
                    <span className="flex flex-col" style={{ opacity: 0.4 }}>
                      <ChevronUp size={10} style={{ marginBottom: -2, color: sortKey === String(col.key) && sortDir === 'asc' ? '#00E5FF' : undefined, opacity: sortKey === String(col.key) && sortDir === 'asc' ? 1 : 0.4 }} />
                      <ChevronDown size={10} style={{ color: sortKey === String(col.key) && sortDir === 'desc' ? '#00E5FF' : undefined, opacity: sortKey === String(col.key) && sortDir === 'desc' ? 1 : 0.4 }} />
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center', padding: '32px', color: 'var(--t3)' }}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sorted.map(row => (
              <tr key={String(row[rowKey])}>
                {columns.map(col => (
                  <td key={String(col.key)}>
                    {col.render ? col.render(row) : String(row[String(col.key)] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

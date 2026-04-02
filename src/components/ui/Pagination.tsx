interface Props {
  page: number
  pages: number
  total: number
  onPageChange: (page: number) => void
}

export default function Pagination({ page, pages, total, onPageChange }: Props) {
  if (pages <= 1) return null

  const getPageNumbers = () => {
    const nums: (number | string)[] = []
    if (pages <= 7) {
      for (let i = 1; i <= pages; i++) nums.push(i)
    } else {
      nums.push(1)
      if (page > 3) nums.push('...')
      for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) nums.push(i)
      if (page < pages - 2) nums.push('...')
      nums.push(pages)
    }
    return nums
  }

  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-3 py-3 text-sm">
      <span className="text-slate-500">Showing page {page} of {pages} ({total} total)</span>
      <div className="flex gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Prev
        </button>
        {getPageNumbers().map((p, i) => (
          typeof p === 'number' ? (
            <button
              key={i}
              onClick={() => onPageChange(p)}
              className={`rounded px-2.5 py-1 ${p === page ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {p}
            </button>
          ) : (
            <span key={i} className="px-2 py-1 text-slate-400">{p}</span>
          )
        ))}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next →
        </button>
      </div>
    </div>
  )
}

type Row = {
  invoice: string
  medicine: string
  generic?: string
  category: string
  packs: string | number
  unitsPerPack: string | number
  unitSale: string | number
  totalItems: string | number
  minStock: string | number
  expiry: string
  supplier: string
  draftId?: string
}

// Helper to determine row status for highlighting
function getRowStatus(r: Row): 'outOfStock' | 'lowStock' | 'expiringSoon' | null {
  // Out of stock: totalItems is 0
  const totalItems = Number(r.totalItems) || 0
  if (totalItems === 0) return 'outOfStock'
  
  // Low stock: totalItems <= minStock
  const minStock = Number(r.minStock) || 0
  if (minStock > 0 && totalItems <= minStock) return 'lowStock'
  
  // Expiring soon: expiry within 30 days
  const expiryStr = String(r.expiry || '').slice(0, 10)
  if (expiryStr && expiryStr !== '-') {
    try {
      const expiryDate = new Date(expiryStr)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const thirtyDaysFromNow = new Date(today)
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
      if (expiryDate <= thirtyDaysFromNow && expiryDate >= today) {
        return 'expiringSoon'
      }
    } catch {}
  }
  
  return null
}

// Helper to get row classes based on status
function getRowClasses(r: Row): string {
  const status = getRowStatus(r)
  switch (status) {
    case 'outOfStock':
      return 'bg-rose-100 hover:bg-rose-200 border-l-4 border-l-rose-600'
    case 'lowStock':
      return 'bg-yellow-200 hover:bg-yellow-300 border-l-4 border-l-yellow-600'
    case 'expiringSoon':
      return 'bg-orange-200 hover:bg-orange-300 border-l-4 border-l-orange-600'
    default:
      return 'hover:bg-slate-50/50'
  }
}

const headers = [
  'Invoice #',
  'Medicine',
  'Generic',
  'Category',
  'Packs',
  'Units/Pack',
  'Unit Sale',
  'Total Items',
  'Min Stock',
  'Expiry',
  'Supplier',
  'Actions',
]

type Props = {
  rows?: Row[]
  pending?: boolean
  onApprove?: (id: string)=>void
  onReject?: (id: string)=>void
  onApproveAll?: ()=>void
  onRejectAll?: ()=>void
  onEdit?: (medicine: string)=>void
  onDelete?: (medicine: string)=>void
  onEditDraft?: (id: string)=>void
  page?: number
  totalPages?: number
  limit?: number
  onChangeLimit?: (n: number)=>void
  onPrev?: ()=>void
  onNext?: ()=>void
}

export default function Pharmacy_InventoryTable({ rows = [], pending = false, onApprove, onReject, onApproveAll, onRejectAll, onEdit, onDelete, onEditDraft, page, totalPages, limit, onChangeLimit, onPrev, onNext }: Props) {
  const hasRows = rows.length > 0
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div />
        <div className="flex items-center gap-2">
          {pending && (
            <>
              <button onClick={onApproveAll} className="rounded-md bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700">Approve All</button>
              <button onClick={onRejectAll} className="rounded-md bg-rose-600 px-2 py-1 text-xs text-white hover:bg-rose-700">Reject All</button>
            </>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              {headers.map(h => (
                <th key={h} className="whitespace-nowrap px-4 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-700">
            {!hasRows && (
              <tr>
                <td colSpan={headers.length} className="px-4 py-12 text-center text-slate-500">
                  No inventory items
                </td>
              </tr>
            )}
            {hasRows && rows.map((r, i) => (
              <tr key={i} className={getRowClasses(r)}>
                <td className="px-4 py-2">{r.invoice}</td>
                <td className="px-4 py-2">{r.medicine}</td>
                <td className="px-4 py-2">{r.generic || '-'}</td>
                <td className="px-4 py-2">{r.category}</td>
                <td className="px-4 py-2">{r.packs}</td>
                <td className="px-4 py-2">{r.unitsPerPack}</td>
                <td className="px-4 py-2">{r.unitSale}</td>
                <td className="px-4 py-2">{r.totalItems}</td>
                <td className="px-4 py-2">{r.minStock}</td>
                <td className="px-4 py-2">
                  {String(r.expiry ?? '-')
                    .split('\n')
                    .map((line, idx) => (
                      <div key={idx} className={idx === 0 ? '' : 'text-xs text-slate-500'}>
                        {line}
                      </div>
                    ))}
                </td>
                <td className="px-4 py-2">{r.supplier}</td>
                <td className="px-4 py-2">
                  {pending ? (
                    <div className="flex gap-2">
                      <button onClick={()=> r.draftId && onEditDraft?.(r.draftId)} className="rounded-md bg-blue-800 px-2 py-1 text-xs text-white hover:bg-blue-900">Edit</button>
                      <button onClick={()=> r.draftId && onApprove?.(r.draftId)} className="rounded-md bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700">Approve</button>
                      <button onClick={()=> r.draftId && onReject?.(r.draftId)} className="rounded-md bg-rose-600 px-2 py-1 text-xs text-white hover:bg-rose-700">Reject</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={()=> onEdit?.(r.medicine)} className="rounded-md bg-blue-800 px-2 py-1 text-xs text-white hover:bg-blue-900">Edit</button>
                      <button onClick={()=> onDelete?.(r.medicine)} className="rounded-md bg-rose-600 px-2 py-1 text-xs text-white hover:bg-rose-700">Delete</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(page != null && totalPages != null) && (
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
          <div>Page {page} of {totalPages}</div>
          <div className="flex items-center gap-2">
            {onChangeLimit && (
              <select
                className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700"
                value={(limit ?? 10)}
                onChange={e => onChangeLimit?.(parseInt(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            )}
            <button onClick={onPrev} disabled={!onPrev || (page<=1)} className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-50">Prev</button>
            <button onClick={onNext} disabled={!onNext || (page>=totalPages)} className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  )
}

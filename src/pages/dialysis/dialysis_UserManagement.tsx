import { useEffect, useState } from 'react'

type User = { _id: string; id?: string; username: string; role: string; fullName?: string; active?: boolean }

const API_BASE = (import.meta as any).env?.VITE_API_BASE || ''

function getToken() {
  try { return localStorage.getItem('dialysis.token') || '' } catch { return '' }
}

export default function Dialysis_UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<string[]>(['admin', 'staff', 'nurse', 'technician'])
  const [newRoleName, setNewRoleName] = useState('')
  const [creatingRole, setCreatingRole] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newRole, setNewRole] = useState<string>('staff')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<{ _id: string; username: string; role: string } | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [notice, setNotice] = useState<{ text: string; kind: 'success'|'error' } | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [addUserError, setAddUserError] = useState('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch(`${API_BASE}/api/dialysis/users`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        const data = await res.json()
        if (mounted && res.ok) {
          setUsers((data.users || []).map((u: any) => ({ ...u, _id: u.id || u._id })))
        }
        // Fetch roles
        const rolesRes = await fetch(`${API_BASE}/api/dialysis/users/roles`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        const rolesData = await rolesRes.json()
        if (mounted && rolesRes.ok && rolesData.roles?.length) {
          setRoles(rolesData.roles)
        }
      } catch (e) { 
        console.error(e)
        if (mounted){ setUsers([]) } 
      }
      finally { if (mounted) setLoading(false) }
    })()
    return () => { mounted = false }
  }, [])

  const addUser = async () => {
    setAddUserError('')
    if (!newUsername.trim()) { setAddUserError('Username is required'); return }
    if (!newPassword || newPassword.length < 4) { setAddUserError('Password must be at least 4 characters'); return }
    
    try {
      const res = await fetch(`${API_BASE}/api/dialysis/users`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ username: newUsername.trim(), role: newRole, password: newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAddUserError(data.error || 'Failed to add user')
        return
      }
      setUsers(prev => [...prev, { ...data.user, _id: data.user.id || data.user._id }])
      setNewUsername(''); setNewPassword(''); setNewRole(roles[0] || 'staff')
      setNotice({ text: 'User added', kind: 'success' })
      setTimeout(()=> setNotice(null), 2500)
    } catch (e) {
      setAddUserError('Failed to add user')
    }
  }

  const performDelete = async () => {
    const id = deleteId
    if (!id) { setDeleteOpen(false); return }
    try {
      const res = await fetch(`${API_BASE}/api/dialysis/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) {
        setUsers(prev=> prev.filter(u=> (u._id !== id && u.id !== id)))
        setNotice({ text: 'User deleted', kind: 'success' })
      }
    } catch {}
    setDeleteOpen(false)
    setDeleteId(null)
    setTimeout(()=> setNotice(null), 2500)
  }

  const saveEdit = async () => {
    if (!editing) return
    setSavingEdit(true)
    try {
      const res = await fetch(`${API_BASE}/api/dialysis/users/${editing._id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ username: editing.username, role: editing.role }),
      })
      if (res.ok) {
        setUsers(prev => prev.map(x => ((x._id === editing._id || x.id === editing._id) ? { ...x, username: editing.username, role: editing.role } : x)))
        setNotice({ text: 'User updated', kind: 'success' })
      }
    } catch {}
    setEditing(null)
    setTimeout(() => setNotice(null), 2500)
    setSavingEdit(false)
  }

  const createRole = async () => {
    const role = String(newRoleName || '').trim().toLowerCase()
    if (!role) return
    setCreatingRole(true)
    // Add role locally (roles are derived from users in backend)
    const next = Array.from(new Set([...(roles || []), role])).sort()
    setRoles(next)
    setNewRoleName('')
    setNewRole(role)
    setNotice({ text: `Role created: ${role}`, kind: 'success' })
    setTimeout(()=> setNotice(null), 2500)
    setCreatingRole(false)
  }

  return (
    <div className="min-h-[70dvh] rounded-xl bg-gradient-to-br from-teal-500/30 via-cyan-300/30 to-emerald-300/30 p-6">
      <div className="mx-auto w-full max-w-7xl rounded-xl bg-white p-6 shadow">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-xl font-bold text-slate-800">User Management</div>
          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${loading? 'border-slate-200 bg-white text-slate-600':'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            <span className={`h-2 w-2 rounded-full ${loading? 'bg-slate-400':'bg-emerald-500'}`} />
            {loading? 'Loading…' : `${users.length} user${users.length===1?'':'s'}`}
          </div>
        </div>

        {notice && (
          <div className={`mb-4 rounded-md border px-3 py-2 text-sm ${notice.kind==='success'? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>{notice.text}</div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div className="text-sm font-semibold text-slate-800">All Users</div>
            </div>
            <div className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-700">
                    <tr>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide">User</th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide">Role</th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {users.map(u => (
                      <tr key={u._id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="grid h-9 w-9 place-items-center rounded-xl bg-teal-100 text-sm font-semibold text-teal-800 ring-1 ring-teal-200">
                              {(u.username||'U').slice(0,1).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900">{u.username}</div>
                              <div className="text-xs text-slate-500">ID: {String(u._id).slice(-6)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3"><span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold capitalize text-slate-700">{u.role}</span></td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button onClick={()=>setEditing({ _id: u._id, username: u.username, role: u.role })} className="rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700">Edit</button>
                            <button onClick={()=>{ setDeleteId(u._id); setDeleteOpen(true) }} className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {users.length===0 && !loading && (
                      <tr><td className="px-5 py-8 text-center text-slate-500" colSpan={3}>No users yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-sm font-semibold text-slate-800">Create Role</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                <input value={newRoleName} onChange={e=>setNewRoleName(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. dialysis-nurse" />
                <button type="button" onClick={createRole} disabled={creatingRole || !newRoleName.trim()} className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{creatingRole? 'Creating…' : 'Create'}</button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-sm font-semibold text-slate-800">Add New User</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(220px,1fr)_auto_minmax(220px,1fr)_auto]">
                <input value={newUsername} onChange={e=>setNewUsername(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Username" />
                <select value={newRole} onChange={e=>setNewRole(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm min-w-[140px]">
                  {(roles||[]).map(r=> <option key={r} value={r}>{r}</option>)}
                </select>
                <input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Password (min 4 chars)" />
                <button onClick={addUser} className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">Add User</button>
                {addUserError && <div className="sm:col-span-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{addUserError}</div>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="px-5 py-3 text-base font-semibold text-white" style={{ background: 'linear-gradient(90deg, #0d9488, #0891b2)' }}>Edit User</div>
            <div className="space-y-3 p-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Username</label>
                <input value={editing.username} onChange={e=>setEditing(prev=> prev? { ...prev, username: e.target.value } : prev)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
                <select value={editing.role} onChange={e=>setEditing(prev=> prev? { ...prev, role: e.target.value } : prev)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                  {(roles||[]).map(r=> <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button type="button" onClick={()=>setEditing(null)} className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={saveEdit} disabled={savingEdit} className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{savingEdit? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="border-b border-slate-200 px-5 py-3 text-base font-semibold text-slate-800">Confirm Delete</div>
            <div className="px-5 py-4 text-sm text-slate-700">Delete this user?</div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button onClick={()=>{ setDeleteOpen(false); setDeleteId(null) }} className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={performDelete} className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

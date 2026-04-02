import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE = (import.meta as any).env?.VITE_API_BASE || ''

export default function Dialysis_Login() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [theme] = useState<'light'|'dark'>(() => {
    try { return (localStorage.getItem('dialysis.theme') as 'light'|'dark') || 'light' } catch { return 'light' }
  })

  useEffect(()=>{
    const html = document.documentElement
    try { html.classList.toggle('dark', theme === 'dark') } catch {}
    return () => { try { html.classList.remove('dark') } catch {} }
  }, [theme])

  const logoSrc = `${(import.meta as any).env?.BASE_URL || '/'}hospital_icon.jpeg`

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const uname = username.trim()
    const pwd = password

    if (!uname || !pwd) {
      setError('Enter username and password')
      return
    }

    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/dialysis/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: uname, password: pwd }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Invalid credentials')
        return
      }
      localStorage.setItem('dialysis.session', JSON.stringify(data.user))
      localStorage.setItem('dialysis.token', data.token)
      navigate('/dialysis')
    } catch (err) {
      setError('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={theme === 'dark' ? 'dialysis-scope dark' : 'dialysis-scope'}>
      <div className="min-h-screen bg-gradient-to-br from-teal-900 via-cyan-900 to-slate-900 flex items-center justify-center p-4 overflow-hidden relative">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-48 -right-48 h-96 w-96 rounded-full bg-teal-500/20 blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute -bottom-56 -left-56 h-[28rem] w-[28rem] rounded-full bg-cyan-500/20 blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />
          <div className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/15 blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '2s' }} />
        </div>

        <style>{`@keyframes float{0%,100%{transform:translateY(0px) rotateX(45deg) rotateZ(45deg)}50%{transform:translateY(-20px) rotateX(55deg) rotateZ(50deg)}}@keyframes rotate3d{0%{transform:perspective(1000px) rotateY(0deg) rotateX(10deg)}100%{transform:perspective(1000px) rotateY(360deg) rotateX(10deg)}}.card-3d{transform-style:preserve-3d;transition:transform .6s cubic-bezier(.23,1,.32,1)}.card-3d:hover{transform:perspective(1000px) rotateY(5deg) rotateX(-5deg) scale(1.02)}`}</style>

        <div className="card-3d relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/5 to-transparent" />
          <div className="relative">
            <div className="relative p-8 pb-6 text-center">
              <div className="mx-auto mb-6 h-24 w-24 overflow-hidden rounded-3xl bg-gradient-to-br from-teal-400/20 to-cyan-600/20 p-1 backdrop-blur-sm" style={{ animation: 'rotate3d 20s linear infinite' }}>
                <div className="h-full w-full overflow-hidden rounded-[1.3rem] bg-white/10 ring-1 ring-white/20">
                  <img src={logoSrc} alt="Dialysis Portal" className="h-full w-full object-cover" />
                </div>
              </div>
              <h1 className="text-3xl font-black bg-gradient-to-r from-teal-200 via-cyan-200 to-emerald-200 bg-clip-text text-transparent mb-2">Dialysis Portal</h1>
              <p className="text-sm text-white/60 font-medium">Dialysis Management System</p>
            </div>

            <div className="p-8 pt-4">
              <form onSubmit={onSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-bold text-white/90">Username</label>
                  <div className="relative group">
                    <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-teal-300/60 transition-colors group-focus-within:text-teal-300">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2-8 4.5V20h16v-1.5c0-2.5-3.58-4.5-8-4.5Z"/></svg>
                    </div>
                    <input type="text" value={username} onChange={(e)=>setUsername(e.target.value)} className="w-full rounded-2xl border-2 border-white/10 bg-white/5 backdrop-blur-sm px-12 py-3.5 text-white placeholder-white/40 outline-none transition-all focus:border-teal-400/50 focus:bg-white/10 focus:ring-4 focus:ring-teal-400/20" placeholder="Enter your username" autoComplete="username" />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-white/90">Password</label>
                  <div className="relative group">
                    <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cyan-300/60 transition-colors group-focus-within:text-cyan-300">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M17 8h-1V6a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-7-2a2 2 0 0 1 4 0v2h-4Z"/></svg>
                    </div>
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e)=>setPassword(e.target.value)} className="w-full rounded-2xl border-2 border-white/10 bg-white/5 backdrop-blur-sm px-12 py-3.5 pr-14 text-white placeholder-white/40 outline-none transition-all focus:border-cyan-400/50 focus:bg-white/10 focus:ring-4 focus:ring-cyan-400/20" placeholder="Enter your password" autoComplete="current-password" />
                    <button type="button" onClick={()=>setShowPassword(s=>!s)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M3.53 2.47 2.47 3.53 5.3 6.36A11.6 11.6 0 0 0 1.4 12c2.1 4.4 6.33 7.5 10.6 7.5 2.07 0 4.1-.66 5.9-1.84l2.6 2.6 1.06-1.06L3.53 2.47ZM12 7.5c.63 0 1.22.18 1.72.48l-5.7 5.7A4.5 4.5 0 0 1 12 7.5Zm0-3c-4.27 0-8.5 3.1-10.6 7.5a12.8 12.8 0 0 0 3 4.05l2.14-2.14A6 6 0 0 1 18 12c0-.52-.06-1.02-.18-1.5H20c-2.1-4.4-6.33-7.5-10.6-7.5Z"/></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 4.5c-4.27 0-8.5 3.1-10.6 7.5 2.1 4.4 6.33 7.5 10.6 7.5s8.5-3.1 10.6-7.5C20.5 7.6 16.27 4.5 12 4.5Zm0 12a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9Zm0-2a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/></svg>
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="rounded-2xl border-2 border-rose-400/30 bg-rose-500/10 backdrop-blur-sm px-4 py-3 text-sm text-rose-200 font-medium">{error}</div>
                )}

                <button type="submit" disabled={loading} className="group relative mt-2 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-teal-500 via-cyan-500 to-emerald-600 px-4 py-4 font-bold text-white shadow-2xl shadow-teal-500/30 transition-all hover:shadow-teal-500/50 hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-teal-400/50 disabled:opacity-70 disabled:cursor-not-allowed">
                  <div className="absolute inset-0 bg-gradient-to-r from-teal-400 via-cyan-400 to-emerald-500 opacity-0 transition-opacity group-hover:opacity-100" />
                  <span className="relative flex items-center justify-center gap-2">
                    {loading ? 'Logging in...' : 'Login'}
                    {!loading && <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 transition-transform group-hover:translate-x-1"><path d="M13.3 17.3 18.6 12l-5.3-5.3-1.4 1.4 3.2 3.2H4v2h11.1l-3.2 3.2 1.4 1.5Z"/></svg>}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="mt-3 w-full rounded-2xl border-2 border-white/20 bg-white/5 px-4 py-3 font-semibold text-white/90 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-4 focus:ring-teal-400/30 transition-colors flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M10 19 3 12l7-7 1.4 1.4L6.8 11H21v2H6.8l4.6 4.6L10 19Z"/></svg>
                  <span>Back to Portal</span>
                </button>
              </form>
            </div>

            <div className="border-t border-white/10 px-8 py-4 text-center">
              <p className="text-xs text-white/40">© 2026 Dialysis Portal</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

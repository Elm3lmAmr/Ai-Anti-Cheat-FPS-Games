'use client'
import { useEffect, useState } from 'react'
import { initializeApp, getApps } from 'firebase/app'
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { getDatabase, ref, get, set, onValue } from 'firebase/database'

const firebaseConfig = {
  apiKey: 'AIzaSyATqZnMVpOAshk7YCaTGkJKh5tFe95LcWg',
  authDomain: 'sentrix-ai-cd8b6.firebaseapp.com',
  databaseURL: 'https://sentrix-ai-cd8b6-default-rtdb.firebaseio.com',
  projectId: 'sentrix-ai-cd8b6',
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getDatabase(app)

export default function Home() {
  const [page, setPage] = useState<'landing'|'login'|'signup'|'app'>('landing')
  const [appPage, setAppPage] = useState('mystats')
  const [user, setUser] = useState<any>(null)
  const [username, setUsername] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPass, setLoginPass] = useState('')
  const [signupUser, setSignupUser] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPass, setSignupPass] = useState('')
  const [authError, setAuthError] = useState('')
  const [players, setPlayers] = useState<any[]>([])
  const [myStats, setMyStats] = useState<any>(null)
  const [toast, setToast] = useState('')
  const [search, setSearch] = useState('')

  // ── Auth + load user info ────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u)
        // Try users/{uid} first, then scan all users for matching email
        try {
          let uname = ''
          let role = 'player'

          const snapUid = await get(ref(db, `users/${u.uid}`))
          if (snapUid.exists()) {
            const data = snapUid.val()
            uname = data.username || u.email?.split('@')[0] || 'Player'
            role = data.role || 'player'
          } else {
            // Scan users node for matching email (handles users/admin structure)
            const snapUsers = await get(ref(db, 'users'))
            if (snapUsers.exists()) {
              snapUsers.forEach((child: any) => {
                const d = child.val()
                if (d.email === u.email || d.uid === u.uid) {
                  uname = d.username || child.key
                  role = d.role || 'player'
                }
              })
            }
            if (!uname) uname = u.email?.split('@')[0] || 'Player'
          }

          setUsername(uname)
          setIsAdmin(role === 'admin')
          if (role === 'admin') setAppPage('admin')
        } catch {
          setUsername(u.email?.split('@')[0] || 'Player')
        }
        setPage('app')
      } else {
        setUser(null)
        setPage('landing')
      }
    })
    return () => unsub()
  }, [])

  // ── Load Firebase players data directly ──────────────────────────────────
  useEffect(() => {
    if (page !== 'app') return
    const playersRef = ref(db, 'players')
    const unsub = onValue(playersRef, (snap) => {
      if (!snap.exists()) return
      const list: any[] = []
      snap.forEach((child) => {
        const key = child.key
        const val = child.val()
        const stats = val.stats || {}
        const kills = stats.kills || 0
        const deaths = stats.deaths || 0
        const headshots = stats.headshots || 0
        const accuracy = stats.accuracy || '0%'
        const hackScore = computeHackScore(kills, deaths, headshots, accuracy)
        list.push({
          uid: key,
          username: stats.playerName || key,
          kills,
          deaths,
          kd: stats.kd || (deaths > 0 ? +(kills/deaths).toFixed(2) : kills),
          headshots,
          hs_ratio: stats.hsRatio || 0,
          fav_weapon: stats.favWeapon || '-',
          accuracy,
          last_updated: stats.lastUpdated || '-',
          hack_score: hackScore,
          status: hackScore >= 75 ? 'suspicious' : hackScore >= 50 ? 'warning' : 'clean',
        })
      })
      setPlayers(list)
    })
    return () => unsub()
  }, [page])

  // ── Load my stats when on mystats page ──────────────────────────────────
  useEffect(() => {
    if (page !== 'app' || appPage !== 'mystats' || !username) return
    const load = async () => {
      // Try players/{username}/stats
      const snap = await get(ref(db, `players/${username}/stats`))
      if (snap.exists()) {
        const s = snap.val()
        const kills = s.kills || 0
        const deaths = s.deaths || 0
        const headshots = s.headshots || 0
        const hackScore = computeHackScore(kills, deaths, headshots, s.accuracy || '0%')
        setMyStats({
          username: s.playerName || username,
          kills, deaths,
          kd: s.kd || (deaths > 0 ? +(kills/deaths).toFixed(2) : kills),
          headshots,
          hs_ratio: s.hsRatio || 0,
          fav_weapon: s.favWeapon || '-',
          accuracy: s.accuracy || '0%',
          last_updated: s.lastUpdated || '-',
          hack_score: hackScore,
          status: hackScore >= 75 ? 'suspicious' : hackScore >= 50 ? 'warning' : 'clean',
        })
      } else {
        // Try scanning players for matching playerName
        const allSnap = await get(ref(db, 'players'))
        if (allSnap.exists()) {
          allSnap.forEach((child: any) => {
            const s = child.val().stats || {}
            if (s.playerName?.toLowerCase() === username.toLowerCase()) {
              const kills = s.kills || 0
              const deaths = s.deaths || 0
              const hackScore = computeHackScore(kills, deaths, s.headshots || 0, s.accuracy || '0%')
              setMyStats({
                username: s.playerName || username,
                kills, deaths,
                kd: s.kd || (deaths > 0 ? +(kills/deaths).toFixed(2) : kills),
                headshots: s.headshots || 0,
                hs_ratio: s.hsRatio || 0,
                fav_weapon: s.favWeapon || '-',
                accuracy: s.accuracy || '0%',
                last_updated: s.lastUpdated || '-',
                hack_score: hackScore,
                status: hackScore >= 75 ? 'suspicious' : hackScore >= 50 ? 'warning' : 'clean',
              })
            }
          })
        }
      }
    }
    load()
  }, [page, appPage, username])

  function computeHackScore(kills: number, deaths: number, headshots: number, accuracy: string) {
    let score = 0
    const kd = kills / Math.max(deaths, 1)
    const hsRatio = headshots / Math.max(kills, 1)
    if (kd > 10) score += 40; else if (kd > 5) score += 20; else if (kd > 3) score += 10
    if (hsRatio > 0.8) score += 30; else if (hsRatio > 0.6) score += 15; else if (hsRatio > 0.4) score += 5
    const acc = parseFloat(accuracy.replace('%', '')) || 0
    if (acc > 90) score += 30; else if (acc > 75) score += 15; else if (acc > 60) score += 5
    return Math.min(score, 100)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function doLogin() {
    setAuthError('')
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPass)
    } catch {
      setAuthError('Invalid email or password.')
    }
  }

  async function doSignup() {
    setAuthError('')
    try {
      const cred = await createUserWithEmailAndPassword(auth, signupEmail, signupPass)
      await set(ref(db, `users/${cred.user.uid}`), {
        username: signupUser, email: signupEmail,
        uid: cred.user.uid, role: 'player',
        createdAt: new Date().toISOString()
      })
      showToast('Account created!')
    } catch (e: any) {
      setAuthError(e.message)
    }
  }

  async function doLogout() {
    await signOut(auth)
    setUser(null); setUsername(''); setIsAdmin(false); setMyStats(null)
    setPage('landing')
  }

  async function flagPlayer(uid: string, name: string) {
    if (!confirm(`Flag ${name}?`)) return
    await set(ref(db, `players/${uid}/flagged`), true)
    showToast(`${name} flagged 🚩`)
  }

  async function banPlayer(uid: string, name: string) {
    if (!confirm(`Ban ${name}?`)) return
    await set(ref(db, `players/${uid}/banned`), true)
    showToast(`${name} banned 🔨`)
  }

  function statusBadge(status: string) {
    const map: any = {
      suspicious: 'bg-red-900/40 text-red-400 border border-red-700',
      warning:    'bg-yellow-900/40 text-yellow-400 border border-yellow-700',
      clean:      'bg-green-900/40 text-green-400 border border-green-700',
    }
    const labels: any = { suspicious: '🚨 SUSPICIOUS', warning: '⚠️ WARNING', clean: '✅ CLEAN' }
    return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${map[status] || map.clean}`}>{labels[status] || '✅ CLEAN'}</span>
  }

  function threatColor(score: number) {
    if (score >= 75) return '#ff4d57'
    if (score >= 50) return '#ffb000'
    return '#00ff8a'
  }

  const summary = {
    total_players: players.length,
    suspicious: players.filter(p => p.status === 'suspicious').length,
    warning: players.filter(p => p.status === 'warning').length,
    clean: players.filter(p => p.status === 'clean').length,
    avg_kd: players.length ? +(players.reduce((a,p) => a + p.kd, 0) / players.length).toFixed(2) : 0,
    threat_rate: players.length ? +((players.filter(p => p.status === 'suspicious').length / players.length) * 100).toFixed(1) : 0,
  }

  const filteredPlayers = players.filter(p => p.username?.toLowerCase().includes(search.toLowerCase()))

  // ── LANDING ──────────────────────────────────────────────────────────────
  if (page === 'landing') return (
    <div className="min-h-screen" style={{ background: 'radial-gradient(ellipse at 20% 50%, rgba(155,93,229,0.08) 0%, transparent 50%), #0a0a0f' }}>
      <nav className="flex items-center justify-between px-16 py-5 border-b border-[#2a2a4a]">
        <div className="font-mono text-xl text-[#00ff8a] tracking-widest" style={{ textShadow: '0 0 20px #00ff8a' }}>SENTRX<span className="text-[#9b5de5]">_</span>AI</div>
        <div className="flex gap-3">
          <button onClick={() => setPage('login')} className="px-4 py-2 text-sm border border-[#2a2a4a] rounded-lg text-[#8888aa] hover:border-[#9b5de5] hover:text-[#9b5de5] transition-all">Login</button>
          <button onClick={() => setPage('signup')} className="px-4 py-2 text-sm bg-[#00ff8a] text-black rounded-lg font-bold hover:bg-[#00cc6e] transition-all">Get Access</button>
        </div>
      </nav>
      <div className="max-w-4xl mx-auto text-center px-8 py-24">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest text-[#9b5de5] border border-purple-700 bg-purple-900/20 mb-8">⚡ REAL-TIME ANTI-CHEAT INTELLIGENCE</div>
        <h1 className="text-6xl font-black leading-tight tracking-tight mb-6">Your game.<br /><span className="text-[#00ff8a]" style={{ textShadow: '0 0 40px rgba(0,255,138,0.3)' }}>Cheat-free.</span></h1>
        <p className="text-lg text-[#8888aa] leading-relaxed max-w-xl mx-auto mb-10">SentrX AI monitors every match, every shot, every movement — and flags cheaters before they ruin the game.</p>
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => setPage('login')} className="px-8 py-3.5 bg-[#00ff8a] text-black rounded-xl font-mono font-bold tracking-wider hover:shadow-[0_0_30px_rgba(0,255,138,0.4)] transition-all">→ LAUNCH DASHBOARD</button>
          <button onClick={() => { setPage('app'); setAppPage('leaderboard') }} className="px-8 py-3.5 border border-[#2a2a4a] rounded-xl text-sm font-semibold hover:border-[#9b5de5] hover:text-[#9b5de5] transition-all">View Leaderboard</button>
          <a href="https://drive.google.com/uc?export=download&id=1BnJ3h3KO-UD45742ZW0sc-DW8PHjDqc2" target="_blank" rel="noopener noreferrer" className="px-8 py-3.5 border border-[#00ff8a] rounded-xl text-sm font-semibold text-[#00ff8a] hover:bg-[#00ff8a] hover:text-black transition-all">⬇ Download Game</a>
        </div>
        <div className="grid grid-cols-3 mt-16 border border-[#2a2a4a] rounded-xl overflow-hidden">
          {[['30+','Active Players'],['12','Threats Detected'],['99.2%','Uptime']].map(([v,l]) => (
            <div key={l} className="bg-[#16162a] py-6"><div className="font-mono text-3xl text-[#00ff8a] font-bold">{v}</div><div className="text-xs text-[#8888aa] mt-1 tracking-wide">{l}</div></div>
          ))}
        </div>
      </div>
    </div>
  )

  // ── AUTH ─────────────────────────────────────────────────────────────────
  if (page === 'login' || page === 'signup') return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="w-full max-w-sm p-10 bg-[#16162a] border border-[#2a2a4a] rounded-2xl">
        <div className="text-center mb-8">
          <div className="font-mono text-2xl text-[#00ff8a] tracking-widest" style={{ textShadow: '0 0 20px #00ff8a' }}>SENTRX AI</div>
          <div className="text-xs text-[#555577] tracking-widest mt-1">ANTI-CHEAT PORTAL</div>
        </div>
        {authError && <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-800 text-red-400 text-xs">{authError}</div>}
        {page === 'login' ? (
          <>
            {[['EMAIL','email',loginEmail,setLoginEmail,'your@email.com'],['PASSWORD','password',loginPass,setLoginPass,'••••••••']].map(([l,t,v,s,p]: any) => (
              <div key={l} className="mb-4">
                <label className="block text-xs font-bold text-[#8888aa] tracking-wider mb-2">{l}</label>
                <input value={v} onChange={(e:any) => s(e.target.value)} type={t} placeholder={p} onKeyDown={(e:any) => e.key==='Enter' && doLogin()}
                  className="w-full bg-[#0a0a0f] border border-[#2a2a4a] rounded-lg px-4 py-3 text-sm text-[#e0e0f0] outline-none focus:border-[#00ff8a] transition-colors" />
              </div>
            ))}
            <button onClick={doLogin} className="w-full py-3 bg-[#00ff8a] text-black font-mono font-bold tracking-widest rounded-lg hover:bg-[#00cc6e] transition-all mt-2">LOGIN →</button>
            <p className="text-center text-xs text-[#8888aa] mt-5">No account? <span className="text-[#9b5de5] cursor-pointer" onClick={() => { setPage('signup'); setAuthError('') }}>Sign up</span> · <span className="text-[#9b5de5] cursor-pointer" onClick={() => setPage('landing')}>← Back</span></p>
          </>
        ) : (
          <>
            {[['USERNAME','text',signupUser,setSignupUser,'Player_Name'],['EMAIL','email',signupEmail,setSignupEmail,'your@email.com'],['PASSWORD','password',signupPass,setSignupPass,'At least 6 chars']].map(([l,t,v,s,p]: any) => (
              <div key={l} className="mb-4">
                <label className="block text-xs font-bold text-[#8888aa] tracking-wider mb-2">{l}</label>
                <input value={v} onChange={(e:any) => s(e.target.value)} type={t} placeholder={p}
                  className="w-full bg-[#0a0a0f] border border-[#2a2a4a] rounded-lg px-4 py-3 text-sm text-[#e0e0f0] outline-none focus:border-[#00ff8a] transition-colors" />
              </div>
            ))}
            <button onClick={doSignup} className="w-full py-3 bg-[#00ff8a] text-black font-mono font-bold tracking-widest rounded-lg hover:bg-[#00cc6e] transition-all mt-2">CREATE ACCOUNT →</button>
            <p className="text-center text-xs text-[#8888aa] mt-5">Have account? <span className="text-[#9b5de5] cursor-pointer" onClick={() => { setPage('login'); setAuthError('') }}>Login</span></p>
          </>
        )}
      </div>
    </div>
  )

  // ── APP ───────────────────────────────────────────────────────────────────
  const navItems = [
    ...(!isAdmin ? [{ id: 'mystats', icon: '🎯', label: 'My Stats' }] : []),
    { id: 'leaderboard', icon: '🏆', label: 'Leaderboard' },
    ...(isAdmin ? [
      { id: 'admin',   icon: '🛡️', label: 'Admin Panel' },
      { id: 'players', icon: '👥', label: 'All Players' },
    ] : [])
  ]

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-60 bg-[#0f0f1a] border-r border-[#2a2a4a] flex flex-col fixed top-0 left-0 bottom-0">
        <div className="px-5 py-6 border-b border-[#2a2a4a]">
          <div className="font-mono text-lg text-[#00ff8a] tracking-widest">SENTRX<span className="text-[#9b5de5]">_</span>AI</div>
          <div className="text-[10px] text-[#555577] tracking-widest mt-1">ANTI-CHEAT PORTAL</div>
        </div>
        <nav className="flex-1 py-4">
          {navItems.map(item => (
            <div key={item.id} onClick={() => setAppPage(item.id)}
              className={`flex items-center gap-3 px-5 py-3 text-sm font-medium cursor-pointer border-l-2 transition-all ${appPage === item.id ? 'border-[#00ff8a] bg-[rgba(0,255,138,0.08)] text-[#00ff8a]' : 'border-transparent text-[#8888aa] hover:text-[#00ff8a] hover:bg-[rgba(0,255,138,0.05)]'}`}>
              <span>{item.icon}</span> {item.label}
            </div>
          ))}
        </nav>
        <div className="p-4 border-t border-[#2a2a4a]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#9b5de5] to-[#00ff8a] flex items-center justify-center text-black font-bold text-sm">
              {username.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-semibold text-[#e0e0f0]">{username}</div>
              <div className="text-[10px] text-[#555577] tracking-wider">{isAdmin ? 'ADMIN' : 'PLAYER'}</div>
            </div>
          </div>
          <button onClick={doLogout} className="w-full py-2 text-xs border border-[#2a2a4a] rounded-lg text-[#8888aa] hover:border-[#9b5de5] hover:text-[#9b5de5] transition-all">Logout</button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 ml-60">
        <div className="h-14 bg-[#0f0f1a] border-b border-[#2a2a4a] flex items-center justify-between px-7 sticky top-0 z-10">
          <div className="text-sm font-semibold">{navItems.find(n => n.id === appPage)?.label || appPage}</div>
          <div className="flex items-center gap-2 text-xs text-[#8888aa]">
            <div className="w-2 h-2 rounded-full bg-[#00ff8a] animate-pulse"></div>
            Firebase Connected
          </div>
        </div>

        <div className="p-7">

          {/* ── MY STATS (WPF style) ── */}
          {appPage === 'mystats' && (
            <div>
              {/* Hero */}
              <div className="bg-[#0d1117] border border-[#2a2a4a] rounded-2xl p-8 mb-6 flex items-center justify-between relative overflow-hidden">
                <div className="absolute inset-0 opacity-5" style={{ background: 'radial-gradient(ellipse at 80% 50%, #9b5de5, transparent)' }}></div>
                <div className="flex items-center gap-6 relative z-10">
                  <div className="w-20 h-20 rounded-full border-2 border-[#00ff8a] flex items-center justify-center text-3xl font-bold"
                    style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)', boxShadow: '0 0 30px rgba(0,255,138,0.3)', color: '#00ff8a' }}>
                    {username.toUpperCase().slice(0,2)}
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white font-mono">{myStats?.username || username}</div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-1.5 text-xs text-[#00ff8a]"><span className="w-2 h-2 rounded-full bg-[#00ff8a] animate-pulse"></span>ONLINE</span>
                      {myStats && statusBadge(myStats.status)}
                    </div>
                    <div className="text-xs text-[#555577] mt-1">ASSAULT CUBE · {myStats?.last_updated || '—'}</div>
                  </div>
                </div>
                <div className="text-right relative z-10">
                  <div className="text-xs text-[#555577] tracking-widest mb-1">CHEAT RISK SCORE</div>
                  <div className="font-mono text-6xl font-bold" style={{ color: threatColor(myStats?.hack_score || 0) }}>
                    {myStats ? myStats.hack_score + '%' : '—'}
                  </div>
                  <div className="text-sm font-semibold mt-1" style={{ color: threatColor(myStats?.hack_score || 0) }}>
                    {myStats?.status === 'suspicious' ? 'Suspicious' : myStats?.status === 'warning' ? 'Warning' : 'Clean'}
                  </div>
                </div>
              </div>

              {/* Stat Cards — WPF style */}
              <div className="grid grid-cols-6 gap-3 mb-6">
                {[
                  { label: 'KD RATIO',   value: myStats?.kd ?? '—',         color: '#00ff8a', icon: '⚔️' },
                  { label: 'HS RATIO',   value: myStats ? myStats.hs_ratio + '%' : '—', color: '#ff6b35', icon: '🎯' },
                  { label: 'KILLS',      value: myStats?.kills ?? '—',       color: '#00ff8a', icon: '💀' },
                  { label: 'DEATHS',     value: myStats?.deaths ?? '—',      color: '#ff4d57', icon: '❌' },
                  { label: 'ACCURACY',   value: myStats?.accuracy ?? '—',    color: '#9b5de5', icon: '🔫' },
                  { label: 'FAV WEAPON', value: myStats?.fav_weapon ?? '—',  color: '#ffb000', icon: '🏆' },
                ].map(s => (
                  <div key={s.label} className="bg-[#0d1117] border border-[#2a2a4a] rounded-xl p-5 relative overflow-hidden group hover:border-[#9b5de5] transition-all">
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 transition-all" style={{ background: s.color, opacity: 0.6 }}></div>
                    <div className="text-lg mb-1 opacity-60">{s.icon}</div>
                    <div className="text-[9px] text-[#555577] tracking-widest uppercase mb-3">{s.label}</div>
                    <div className="font-mono text-2xl font-bold" style={{ color: s.color }}>{String(s.value)}</div>
                  </div>
                ))}
              </div>

              {/* No stats message */}
              {!myStats && (
                <div className="text-center py-12 bg-[#0d1117] border border-[#2a2a4a] rounded-xl">
                  <div className="text-4xl mb-4">🎮</div>
                  <div className="text-[#8888aa] text-sm">No stats found for <span className="text-[#9b5de5] font-bold">{username}</span></div>
                  <div className="text-[#555577] text-xs mt-2">Play a match first to see your stats here</div>
                </div>
              )}
            </div>
          )}

          {/* ── LEADERBOARD ── */}
          {appPage === 'leaderboard' && (
            <div className="bg-[#16162a] border border-[#2a2a4a] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a4a]">
                <div className="text-sm font-semibold">🏆 Leaderboard — Top Players by Kills</div>
              </div>
              <table className="w-full">
                <thead><tr className="bg-[#13131f]">
                  {['#','Player','Kills','Deaths','K/D','HS%','Accuracy','Weapon','Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] text-[#555577] tracking-widest">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {[...players].sort((a,b) => b.kills - a.kills).map((p, i) => (
                    <tr key={p.uid} className="border-t border-[#2a2a4a]/50 hover:bg-white/[0.01]">
                      <td className={`px-4 py-3 font-mono font-bold ${i===0?'text-yellow-400':i===1?'text-gray-400':i===2?'text-orange-600':'text-[#555577]'}`}>{i+1}</td>
                      <td className="px-4 py-3 text-sm font-semibold">{p.username}</td>
                      <td className="px-4 py-3 font-mono text-[#00ff8a] text-sm">{p.kills}</td>
                      <td className="px-4 py-3 font-mono text-xs">{p.deaths}</td>
                      <td className="px-4 py-3 font-mono text-xs">{p.kd}</td>
                      <td className="px-4 py-3 font-mono text-xs">{p.hs_ratio}%</td>
                      <td className="px-4 py-3 font-mono text-xs">{p.accuracy}</td>
                      <td className="px-4 py-3 text-xs text-[#8888aa]">{p.fav_weapon}</td>
                      <td className="px-4 py-3">{statusBadge(p.status)}</td>
                    </tr>
                  ))}
                  {players.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-xs text-[#555577]">Loading...</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* ── ADMIN PANEL ── */}
          {appPage === 'admin' && isAdmin && (
            <div>
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: 'Suspicious', value: summary.suspicious, color: 'text-[#ff4d57]' },
                  { label: 'Warning',    value: summary.warning,    color: 'text-[#ffb000]' },
                  { label: 'Clean',      value: summary.clean,      color: 'text-[#00ff8a]' },
                ].map(s => (
                  <div key={s.label} className="bg-[#16162a] border border-[#2a2a4a] rounded-xl p-5">
                    <div className="text-[10px] text-[#555577] tracking-widest uppercase mb-2">{s.label}</div>
                    <div className={`font-mono text-3xl font-bold ${s.color}`}>{s.value}</div>
                  </div>
                ))}
              </div>
              <div className="bg-[#16162a] border border-[#2a2a4a] rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[#2a2a4a] text-sm font-semibold">🛡️ Threat Monitor — All Players</div>
                <table className="w-full">
                  <thead><tr className="bg-[#13131f]">
                    {['Player','Kills','K/D','HS%','Hack Score','Status','Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] text-[#555577] tracking-widest">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {[...players].sort((a,b) => b.hack_score - a.hack_score).map(p => (
                      <tr key={p.uid} className="border-t border-[#2a2a4a]/50 hover:bg-white/[0.01]">
                        <td className="px-4 py-3 text-sm font-semibold">{p.username}</td>
                        <td className="px-4 py-3 font-mono text-[#00ff8a] text-sm">{p.kills}</td>
                        <td className="px-4 py-3 font-mono text-xs">{p.kd}</td>
                        <td className="px-4 py-3 font-mono text-xs">{p.hs_ratio}%</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-[#2a2a4a] rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${p.hack_score}%`, background: threatColor(p.hack_score) }}></div>
                            </div>
                            <span className="font-mono text-xs w-7" style={{ color: threatColor(p.hack_score) }}>{p.hack_score}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">{statusBadge(p.status)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => flagPlayer(p.uid, p.username)} className="px-2 py-1 text-xs border border-[#2a2a4a] rounded text-[#8888aa] hover:border-[#9b5de5] hover:text-[#9b5de5] transition-all">Flag</button>
                            <button onClick={() => banPlayer(p.uid, p.username)} className="px-2 py-1 text-xs rounded bg-red-900/20 border border-red-800 text-red-400 hover:bg-red-900/40 transition-all">Ban</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── ALL PLAYERS ── */}
          {appPage === 'players' && isAdmin && (
            <div className="bg-[#16162a] border border-[#2a2a4a] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a4a]">
                <div className="text-sm font-semibold">👥 All Players ({players.length})</div>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search player..."
                  className="bg-[#13131f] border border-[#2a2a4a] rounded-lg px-4 py-2 text-sm text-[#e0e0f0] outline-none focus:border-[#9b5de5] w-64" />
              </div>
              <table className="w-full">
                <thead><tr className="bg-[#13131f]">
                  {['Player','Kills','Deaths','K/D','HS%','Accuracy','Weapon','Last Active','Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] text-[#555577] tracking-widest">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filteredPlayers.map(p => (
                    <tr key={p.uid} className="border-t border-[#2a2a4a]/50 hover:bg-white/[0.01]">
                      <td className="px-4 py-3 text-sm font-semibold">{p.username}</td>
                      <td className="px-4 py-3 font-mono text-xs">{p.kills}</td>
                      <td className="px-4 py-3 font-mono text-xs">{p.deaths}</td>
                      <td className="px-4 py-3 font-mono text-xs">{p.kd}</td>
                      <td className="px-4 py-3 font-mono text-xs">{p.hs_ratio}%</td>
                      <td className="px-4 py-3 font-mono text-xs">{p.accuracy}</td>
                      <td className="px-4 py-3 text-xs text-[#8888aa]">{p.fav_weapon}</td>
                      <td className="px-4 py-3 text-xs text-[#555577]">{p.last_updated || '—'}</td>
                      <td className="px-4 py-3">{statusBadge(p.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#1c1c33] border border-[#2a2a4a] rounded-xl px-5 py-3 text-sm text-[#e0e0f0] shadow-2xl z-50">
          {toast}
        </div>
      )}
    </div>
  )
}

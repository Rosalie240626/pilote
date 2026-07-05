'use client'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '../../lib/supabase'

const NAV = [
  { icon: '🏠', label: 'Accueil', href: '/dashboard' },
  { icon: '🧾', label: 'Recettes', href: '/dashboard/recettes' },
  { icon: '🥩', label: 'Ingrédients', href: '/dashboard/ingredients' },
  { icon: '🎯', label: 'Prix IA', href: '/dashboard/prix' },
  { icon: '📅', label: 'Achalandage', href: '/dashboard/achalandage' },
  { icon: '⚙️', label: 'Restaurant', href: '/dashboard/restaurant' },
]

export default function DashboardLayout({ children }) {
  const [dark, setDark] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const [user, setUser] = useState(null)
  const [orgNom, setOrgNom] = useState('')
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')
    setUser(user)
    const { data: member } = await supabase.from('organization_members').select('organizations(nom)').eq('user_id', user.id).single()
    if (member?.organizations?.nom) setOrgNom(member.organizations.nom)
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const t = dark ? {
    bg: '#0f1117', sidebar: '#161b27', navbar: '#161b27',
    border: 'rgba(255,255,255,0.07)', text: '#f0f4ff', muted: '#8b9bb4',
    active: 'rgba(0,194,255,0.12)', activeText: '#00C2FF', hover: 'rgba(255,255,255,0.04)',
  } : {
    bg: '#f4f6fa', sidebar: '#ffffff', navbar: '#ffffff',
    border: 'rgba(0,0,0,0.08)', text: '#1a1f2e', muted: '#6b7280',
    active: 'rgba(0,120,200,0.08)', activeText: '#0078C8', hover: 'rgba(0,0,0,0.03)',
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: t.bg, fontFamily: "'Inter', 'Segoe UI', sans-serif", color: t.text }}>

      {/* Sidebar */}
      <div style={{ width: collapsed ? '60px' : '220px', background: t.sidebar, borderRight: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', transition: 'width 0.2s', flexShrink: 0, position: 'fixed', top: 0, bottom: 0, zIndex: 100 }}>
        <div style={{ padding: collapsed ? '20px 12px' : '20px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {!collapsed && <span style={{ fontWeight: '800', fontSize: '18px', color: '#00C2FF', letterSpacing: '-0.5px' }}>PILOTE</span>}
          <button onClick={() => setCollapsed(!collapsed)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.muted, fontSize: '18px', padding: '4px' }}>
            {collapsed ? '→' : '←'}
          </button>
        </div>

        <nav style={{ flex: 1, padding: '8px' }}>
          {NAV.map(item => {
            const active = pathname === item.href
            return (
              <div key={item.href} onClick={() => router.push(item.href)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', cursor: 'pointer', marginBottom: '2px', background: active ? t.active : 'transparent', color: active ? t.activeText : t.text, fontWeight: active ? '600' : '400', fontSize: '14px', transition: 'background 0.15s' }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = t.hover }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </div>
            )
          })}
        </nav>

        <div style={{ padding: '8px', borderTop: `1px solid ${t.border}` }}>
          <div onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', cursor: 'pointer', color: t.muted, fontSize: '14px' }}
            onMouseEnter={e => e.currentTarget.style.background = t.hover}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <span style={{ fontSize: '16px' }}>🚪</span>
            {!collapsed && <span>Déconnexion</span>}
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, marginLeft: collapsed ? '60px' : '220px', display: 'flex', flexDirection: 'column', transition: 'margin-left 0.2s' }}>

        {/* Navbar */}
        <div style={{ background: t.navbar, borderBottom: `1px solid ${t.border}`, padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 99 }}>
          <div>
            {orgNom && <span style={{ fontWeight: '600', fontSize: '14px' }}>{orgNom}</span>}
            {!orgNom && <span style={{ color: t.muted, fontSize: '14px' }}>Mon restaurant</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ color: t.muted, fontSize: '13px' }}>{user?.email}</span>
            <button onClick={() => setDark(!dark)} style={{ background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '20px', padding: '6px 14px', cursor: 'pointer', color: t.text, fontSize: '13px' }}>
              {dark ? '☀️ Clair' : '🌙 Sombre'}
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: '32px 28px', overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
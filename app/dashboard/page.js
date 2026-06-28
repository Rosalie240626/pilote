'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')
      setUser(user)
    }
    getUser()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!user) return null

  return (
    <div style={{ minHeight:'100vh', background:'#0A0F1E', fontFamily:'sans-serif', color:'white' }}>
      <div style={{ background:'#111827', borderBottom:'1px solid rgba(0,194,255,0.15)', padding:'16px 32px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h1 style={{ color:'#00C2FF', fontWeight:'800', fontSize:'24px', margin:0 }}>PILOTE</h1>
        <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
          <span style={{ color:'#8B9BB4', fontSize:'14px' }}>{user.email}</span>
          <button onClick={handleLogout}
            style={{ padding:'8px 16px', borderRadius:'8px', background:'transparent', border:'1px solid #8B9BB4', color:'#8B9BB4', cursor:'pointer' }}>
            Déconnexion
          </button>
        </div>
      </div>

      <div style={{ padding:'40px 32px' }}>
        <h2 style={{ fontSize:'28px', fontWeight:'700', marginBottom:'8px' }}>Bonjour 👋</h2>
        <p style={{ color:'#8B9BB4', marginBottom:'40px' }}>Bienvenue sur Pilote — configurons votre restaurant.</p>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'16px' }}>
           {[
          { icon:'🍽️', label:'Mon Restaurant', desc:'Configurer le profil', color:'#00C2FF', url:'/dashboard/restaurant' },
          { icon:'💊', label:'Score de Santé', desc:'Bientôt disponible', color:'#00E5A0' },
{ icon:'🎯', label:'Fixation de prix IA', desc:'Prix optimal par plat', color:'#F5A623', url:'/dashboard/prix' },
          { icon:'🥩', label:'Ingrédients', desc:'Gérer mes ingrédients', color:'#00C2FF', url:'/dashboard/ingredients' },
          { icon:'🧾', label:'Mes Recettes', desc:'Gérer mes recettes', color:'#F5A623', url:'/dashboard/recettes' },
          { icon:'🧬', label:'Jumeau Numérique', desc:'Bientôt disponible', color:'#B47FFF' },
        ].map((card, i) => (
            <div key={i} onClick={() => card.url && router.push(card.url)} style={{ background:'#111827', border:`1px solid ${card.color}30`, borderRadius:'16px', padding:'24px', cursor:'pointer' }}>
              <div style={{ fontSize:'32px', marginBottom:'12px' }}>{card.icon}</div>
              <div style={{ fontWeight:'700', fontSize:'16px', color:card.color }}>{card.label}</div>
              <div style={{ color:'#8B9BB4', fontSize:'13px', marginTop:'4px' }}>{card.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

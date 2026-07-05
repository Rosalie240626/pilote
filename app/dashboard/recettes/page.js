'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Recettes() {
  const [recettes, setRecettes] = useState([])
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')
    const { data: member } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).single()
    if (!member) return router.push('/dashboard/restaurant')
    const { data } = await supabase.from('recettes').select('*, recette_ingredients(grammage, ingredients(nom, prix_unitaire, unite))').eq('organization_id', member.organization_id).order('nom')
    setRecettes(data || [])
  }

  function cout(r) {
    return r.recette_ingredients?.reduce((acc, ri) => {
      const f = (ri.ingredients?.unite === 'g' || ri.ingredients?.unite === 'ml') ? ri.grammage / 1000 : ri.grammage
      return acc + (ri.ingredients?.prix_unitaire || 0) * f
    }, 0) || 0
  }

  function fc(r) {
    const c = cout(r)
    return r.prix_vente ? ((c / r.prix_vente) * 100).toFixed(1) : null
  }

  function fcColor(v) { return v <= 28 ? '#00E5A0' : v <= 35 ? '#F5A623' : '#FF4D6D' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>Recettes</h1>
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Fiches recettes et calcul du food cost</p>
        </div>
        <button onClick={() => router.push('/dashboard/recettes/nouvelle')} style={{ padding: '9px 20px', borderRadius: '8px', background: '#00C2FF', color: '#0A0F1E', fontWeight: '700', border: 'none', cursor: 'pointer' }}>+ Nouvelle recette</button>
      </div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '10px 20px', borderBottom: '1px solid var(--border)' }}>
          {['Nom','Coût matière','Prix vente','Food cost'].map((h, i) => <span key={i} style={{ color: 'var(--muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>{h}</span>)}
        </div>
        {recettes.length === 0 && (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <p style={{ color: 'var(--muted)', marginBottom: '12px' }}>Aucune recette</p>
            <button onClick={() => router.push('/dashboard/recettes/nouvelle')} style={{ padding: '9px 20px', borderRadius: '8px', background: '#00C2FF', color: '#0A0F1E', fontWeight: '700', border: 'none', cursor: 'pointer' }}>+ Créer la première</button>
          </div>
        )}
        {recettes.map(r => {
          const c = cout(r), f = fc(r)
          return (
            <div key={r.id} onClick={() => router.push(`/dashboard/recettes/${r.id}`)} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '14px 20px', borderBottom: '1px solid var(--border)', cursor: 'pointer', alignItems: 'center' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div>
                <div style={{ fontWeight: '500' }}>{r.nom}</div>
                <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{r.categorie || 'Sans catégorie'} · {r.recette_ingredients?.length || 0} ingrédients</div>
              </div>
              <span style={{ color: '#00C2FF', fontSize: '14px' }}>{c.toFixed(2)}$</span>
              <span style={{ fontSize: '14px' }}>{r.prix_vente ? `${r.prix_vente}$` : '—'}</span>
              <span style={{ fontSize: '14px', color: f ? fcColor(f) : 'var(--muted)' }}>{f ? `${f}%` : '—'}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

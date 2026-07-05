'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Prix() {
  const [recettes, setRecettes] = useState([])
  const [selected, setSelected] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [org, setOrg] = useState(null)
  const [prixConcurrents, setPrixConcurrents] = useState('')
  const [prixMax, setPrixMax] = useState('')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')
    const { data: member } = await supabase.from('organization_members').select('organization_id, organizations(*)').eq('user_id', user.id).single()
    if (!member) return router.push('/dashboard/restaurant')
    setOrg(member.organizations)
    const { data } = await supabase.from('recettes').select('*, recette_ingredients(grammage, ingredients(nom, prix_unitaire, unite))').eq('organization_id', member.organization_id)
    setRecettes(data || [])
  }

  function cout(r) {
    return r.recette_ingredients?.reduce((acc, ri) => {
      const f = (ri.ingredients?.unite === 'g' || ri.ingredients?.unite === 'ml') ? ri.grammage / 1000 : ri.grammage
      return acc + (ri.ingredients?.prix_unitaire || 0) * f
    }, 0) || 0
  }

  async function analyser() {
    if (!selected) return
    setLoading(true); setResult(null)
    const res = await fetch('/api/prix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: selected.nom, cout: cout(selected).toFixed(2), positionnement: org?.positionnement || 'casual', style_cuisine: org?.style_cuisine?.join(', '), clientele: org?.clientele_cible?.join(', '), ville: org?.ville, prix_concurrents: prixConcurrents || null, prix_max: prixMax || null })
    })
    setResult(await res.json())
    setLoading(false)
  }

  const inp = { width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'inherit', fontSize: '14px', boxSizing: 'border-box' }
  const fcColor = fc => fc <= 28 ? '#00E5A0' : fc <= 35 ? '#F5A623' : '#FF4D6D'

  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>Fixation de prix IA</h1>
      <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '28px' }}>L'IA recherche les prix concurrents et suggère le prix optimal</p>

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
        <p style={{ color: 'var(--muted)', fontSize: '12px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Choisir un plat</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
          {recettes.map(r => (
            <div key={r.id} onClick={() => { setSelected(r); setResult(null) }} style={{ padding: '8px 16px', borderRadius: '8px', border: `1px solid ${selected?.id === r.id ? '#00C2FF' : 'var(--border)'}`, background: selected?.id === r.id ? 'rgba(0,194,255,0.08)' : 'transparent', cursor: 'pointer', fontSize: '14px' }}>
              {r.nom} — <span style={{ color: '#00C2FF' }}>{cout(r).toFixed(2)}$</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div><label style={{ color: 'var(--muted)', fontSize: '12px', display: 'block', marginBottom: '6px' }}>PRIX MOYEN CONCURRENTS ($)</label><input type="number" placeholder="Ex: 18.00" value={prixConcurrents} onChange={e => setPrixConcurrents(e.target.value)} style={inp} /></div>
          <div><label style={{ color: 'var(--muted)', fontSize: '12px', display: 'block', marginBottom: '6px' }}>PRIX MAXIMUM ($)</label><input type="number" placeholder="Ex: 25.00" value={prixMax} onChange={e => setPrixMax(e.target.value)} style={inp} /></div>
        </div>
        <button onClick={analyser} disabled={!selected || loading} style={{ padding: '9px 24px', borderRadius: '8px', background: selected ? '#00C2FF' : 'var(--border)', color: selected ? '#0A0F1E' : 'var(--muted)', fontWeight: '700', border: 'none', cursor: selected ? 'pointer' : 'default' }}>
          {loading ? '⏳ Analyse en cours...' : '✨ Analyser avec l\'IA'}
        </button>
      </div>

      {result && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
          <div style={{ textAlign: 'center', padding: '20px', marginBottom: '16px', background: 'rgba(0,194,255,0.06)', borderRadius: '10px', border: '1px solid rgba(0,194,255,0.15)' }}>
            <div style={{ color: 'var(--muted)', fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Prix recommandé</div>
            <div style={{ fontSize: '48px', fontWeight: '800', color: '#00C2FF' }}>{result.prix_suggere}$</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Fourchette : {result.prix_min}$ — {result.prix_max}$</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '14px' }}><div style={{ color: 'var(--muted)', fontSize: '12px', marginBottom: '4px' }}>FOOD COST</div><div style={{ fontWeight: '700', fontSize: '20px', color: fcColor(result.food_cost_pct) }}>{result.food_cost_pct}%</div></div>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '14px' }}><div style={{ color: 'var(--muted)', fontSize: '12px', marginBottom: '4px' }}>MARGE PAR PLAT</div><div style={{ fontWeight: '700', fontSize: '20px', color: '#00E5A0' }}>{(result.prix_suggere - cout(selected)).toFixed(2)}$</div></div>
          </div>
          {result.prix_concurrents_trouves && <div style={{ background: 'rgba(180,127,255,0.06)', border: '1px solid rgba(180,127,255,0.2)', borderRadius: '8px', padding: '14px', marginBottom: '12px' }}><div style={{ color: '#B47FFF', fontSize: '12px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>🔍 Concurrents trouvés</div><p style={{ fontSize: '13px', margin: 0 }}>{result.prix_concurrents_trouves}</p></div>}
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '14px', marginBottom: '12px' }}><div style={{ color: 'var(--muted)', fontSize: '12px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>Justification</div><p style={{ fontSize: '13px', margin: 0 }}>{result.justification}</p></div>
          <div style={{ background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.2)', borderRadius: '8px', padding: '14px' }}><div style={{ color: '#F5A623', fontSize: '12px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>💡 Conseil</div><p style={{ fontSize: '13px', margin: 0 }}>{result.conseil}</p></div>
        </div>
      )}
    </div>
  )
}

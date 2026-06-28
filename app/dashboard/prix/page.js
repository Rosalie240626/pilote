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

  function coutRecette(r) {
    return r.recette_ingredients?.reduce((acc, ri) => {
      const prix = ri.ingredients?.prix_unitaire || 0
      const grammage = ri.grammage || 0
      const unite = ri.ingredients?.unite
      const facteur = (unite === 'g' || unite === 'ml') ? grammage / 1000 : grammage
      return acc + (prix * facteur)
    }, 0) || 0
  }

  async function analyser() {
    if (!selected) return
    setLoading(true)
    setResult(null)
    const cout = coutRecette(selected)
    const res = await fetch('/api/prix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nom: selected.nom,
        cout: cout.toFixed(2),
        ville: org?.ville,
        positionnement: org?.positionnement || 'casual',
        style_cuisine: org?.style_cuisine?.join(', '),
        clientele: org?.clientele_cible?.join(', '),
        prix_concurrents: prixConcurrents || null,
        prix_max: prixMax || null,
      })
    })
    const data = await res.json()
    setResult(data)
    setLoading(false)
  }

  function couleurFC(fc) {
    if (fc <= 28) return '#00E5A0'
    if (fc <= 35) return '#F5A623'
    return '#FF4D6D'
  }

  const inp = { width:'100%', padding:'10px 12px', borderRadius:'8px', border:'1px solid #1F2937', background:'#1F2937', color:'white', fontSize:'14px', boxSizing:'border-box' }

  return (
    <div style={{ minHeight:'100vh', background:'#0A0F1E', color:'white', fontFamily:'sans-serif' }}>
      <div style={{ background:'#111827', borderBottom:'1px solid rgba(0,194,255,0.15)', padding:'16px 32px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h1 style={{ color:'#00C2FF', fontWeight:'800', fontSize:'24px', margin:0, cursor:'pointer' }} onClick={() => router.push('/dashboard')}>PILOTE</h1>
        <span onClick={() => router.push('/dashboard')} style={{ color:'#8B9BB4', fontSize:'14px', cursor:'pointer' }}>← Retour</span>
      </div>

      <div style={{ maxWidth:'800px', margin:'40px auto', padding:'0 24px' }}>
        <h2 style={{ fontSize:'22px', fontWeight:'700', marginBottom:'8px' }}>🎯 Fixation de prix IA</h2>
        <p style={{ color:'#8B9BB4', marginBottom:'32px' }}>Sélectionne un plat — l'IA suggère le prix optimal selon ton positionnement.</p>

        <div style={{ background:'#111827', border:'1px solid rgba(0,194,255,0.15)', borderRadius:'16px', padding:'24px', marginBottom:'16px' }}>
          <p style={{ color:'#8B9BB4', fontSize:'12px', marginBottom:'12px', textTransform:'uppercase', letterSpacing:'1px' }}>Choisir un plat</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:'10px', marginBottom:'16px' }}>
            {recettes.map(r => {
              const cout = coutRecette(r)
              const isSelected = selected?.id === r.id
              return (
                <div key={r.id} onClick={() => { setSelected(r); setResult(null) }}
                  style={{ padding:'14px', borderRadius:'10px', border:`1px solid ${isSelected ? '#00C2FF' : '#1F2937'}`, background: isSelected ? 'rgba(0,194,255,0.08)' : 'transparent', cursor:'pointer' }}>
                  <div style={{ fontWeight:'600', fontSize:'14px', marginBottom:'4px' }}>{r.nom}</div>
                  <div style={{ color:'#00C2FF', fontSize:'13px' }}>Coût: {cout.toFixed(2)}$</div>
                  {r.prix_vente && <div style={{ color:'#8B9BB4', fontSize:'12px' }}>Vente actuelle: {r.prix_vente}$</div>}
                </div>
              )
            })}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px' }}>
            <div>
              <label style={{ color:'#8B9BB4', fontSize:'12px', display:'block', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'1px' }}>Prix moyen concurrents ($)</label>
              <input type="number" placeholder="Ex: 18.00" value={prixConcurrents} onChange={e => setPrixConcurrents(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={{ color:'#8B9BB4', fontSize:'12px', display:'block', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'1px' }}>Prix maximum à ne pas dépasser ($)</label>
              <input type="number" placeholder="Ex: 25.00" value={prixMax} onChange={e => setPrixMax(e.target.value)} style={inp} />
            </div>
          </div>

          {recettes.length === 0 && <p style={{ color:'#8B9BB4' }}>Aucune recette — créez d'abord des recettes dans "Mes Recettes"</p>}
          <button onClick={analyser} disabled={!selected || loading}
            style={{ padding:'12px 28px', borderRadius:'8px', background: selected ? '#00C2FF' : '#1F2937', color: selected ? '#0A0F1E' : '#8B9BB4', fontWeight:'700', border:'none', cursor: selected ? 'pointer' : 'default', fontSize:'15px' }}>
            {loading ? '⏳ Analyse en cours...' : "✨ Analyser avec l'IA"}
          </button>
        </div>

        {result && (
          <div style={{ background:'#111827', border:'1px solid rgba(0,194,255,0.2)', borderRadius:'16px', padding:'28px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'24px' }}>
              <span style={{ fontSize:'24px' }}>🤖</span>
              <div>
                <div style={{ fontWeight:'700', fontSize:'18px', color:'#00C2FF' }}>Recommandation IA pour {selected.nom}</div>
                <div style={{ color:'#8B9BB4', fontSize:'13px' }}>Basé sur ton positionnement et ta clientèle</div>
              </div>
            </div>

            <div style={{ background:'rgba(0,194,255,0.06)', border:'1px solid rgba(0,194,255,0.2)', borderRadius:'12px', padding:'20px', marginBottom:'16px', textAlign:'center' }}>
              <div style={{ color:'#8B9BB4', fontSize:'12px', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'1px' }}>Prix recommandé</div>
              <div style={{ fontSize:'48px', fontWeight:'800', color:'#00C2FF' }}>{result.prix_suggere}$</div>
              <div style={{ color:'#8B9BB4', fontSize:'13px', marginTop:'4px' }}>Fourchette : {result.prix_min}$ — {result.prix_max_suggere}$</div>
              {prixMax && <div style={{ color:'#F5A623', fontSize:'13px', marginTop:'4px' }}>Maximum fixé : {prixMax}$</div>}
              {prixConcurrents && <div style={{ color:'#8B9BB4', fontSize:'13px', marginTop:'4px' }}>Concurrents : {prixConcurrents}$ en moyenne</div>}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px' }}>
              <div style={{ background:'#0A0F1E', borderRadius:'10px', padding:'16px' }}>
                <div style={{ color:'#8B9BB4', fontSize:'12px', marginBottom:'4px' }}>FOOD COST</div>
                <div style={{ fontWeight:'700', fontSize:'22px', color: couleurFC(result.food_cost_pct) }}>{result.food_cost_pct}%</div>
              </div>
              <div style={{ background:'#0A0F1E', borderRadius:'10px', padding:'16px' }}>
                <div style={{ color:'#8B9BB4', fontSize:'12px', marginBottom:'4px' }}>MARGE PAR PLAT</div>
                <div style={{ fontWeight:'700', fontSize:'22px', color:'#00E5A0' }}>{(result.prix_suggere - coutRecette(selected)).toFixed(2)}$</div>
              </div>
            </div>

            
          {result.prix_concurrents_trouves && (
  <div style={{ background:'rgba(180,127,255,0.06)', border:'1px solid rgba(180,127,255,0.2)', borderRadius:'10px', padding:'16px', marginBottom:'12px' }}>
    <div style={{ color:'#B47FFF', fontSize:'12px', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'1px' }}>🔍 Prix concurrents trouvés</div>
    <p style={{ color:'#F0F4FF', fontSize:'14px', lineHeight:'1.6', margin:0 }}>{result.prix_concurrents_trouves}</p>
    {result.sources_consultees && <p style={{ color:'#8B9BB4', fontSize:'12px', marginTop:'8px', margin:0 }}>Sources: {result.sources_consultees}</p>}
  </div>
)}
<div style={{ background:'#0A0F1E', borderRadius:'10px', padding:'16px', marginBottom:'12px' }}>
  <div style={{ color:'#8B9BB4', fontSize:'12px', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'1px' }}>Justification</div>
  <p style={{ color:'#F0F4FF', fontSize:'14px', lineHeight:'1.6', margin:0 }}>{result.justification}</p>
</div>

            <div style={{ background:'rgba(245,166,35,0.06)', border:'1px solid rgba(245,166,35,0.2)', borderRadius:'10px', padding:'16px' }}>
              <div style={{ color:'#F5A623', fontSize:'12px', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'1px' }}>💡 Conseil Pilote</div>
              <p style={{ color:'#F0F4FF', fontSize:'14px', lineHeight:'1.6', margin:0 }}>{result.conseil}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

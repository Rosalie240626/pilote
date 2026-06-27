'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Recettes() {
  const [recettes, setRecettes] = useState([])
  const [orgId, setOrgId] = useState(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')
    const { data: member } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).single()
    if (!member) return router.push('/dashboard/restaurant')
    setOrgId(member.organization_id)
    const { data } = await supabase.from('recettes').select('*, recette_ingredients(grammage, ingredients(nom, prix_unitaire, unite))').eq('organization_id', member.organization_id).order('nom')
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

  function foodCost(r) {
    if (!r.prix_vente || r.prix_vente === 0) return null
    return ((coutRecette(r) / r.prix_vente) * 100).toFixed(1)
  }

  function couleurFC(fc) {
    if (fc <= 28) return '#00E5A0'
    if (fc <= 35) return '#F5A623'
    return '#FF4D6D'
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0F1E', color: 'white', fontFamily: 'sans-serif' }}>
      <div style={{ background: '#111827', borderBottom: '1px solid rgba(0,194,255,0.15)', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ color: '#00C2FF', fontWeight: '800', fontSize: '24px', margin: 0, cursor: 'pointer' }} onClick={() => router.push('/dashboard')}>PILOTE</h1>
        <span onClick={() => router.push('/dashboard')} style={{ color: '#8B9BB4', fontSize: '14px', cursor: 'pointer' }}>← Retour</span>
      </div>

      <div style={{ maxWidth: '900px', margin: '40px auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>🧾 Mes recettes</h2>
          <button onClick={() => router.push('/dashboard/recettes/nouvelle')}
            style={{ padding: '10px 20px', borderRadius: '8px', background: '#00C2FF', color: '#0A0F1E', fontWeight: '700', border: 'none', cursor: 'pointer' }}>
            + Nouvelle recette
          </button>
        </div>

        {recettes.length === 0 ? (
          <div style={{ background: '#111827', border: '1px solid rgba(0,194,255,0.15)', borderRadius: '16px', padding: '48px', textAlign: 'center' }}>
            <p style={{ color: '#8B9BB4', marginBottom: '16px' }}>Aucune recette — créez votre première fiche recette</p>
            <button onClick={() => router.push('/dashboard/recettes/nouvelle')}
              style={{ padding: '10px 20px', borderRadius: '8px', background: '#00C2FF', color: '#0A0F1E', fontWeight: '700', border: 'none', cursor: 'pointer' }}>
              + Nouvelle recette
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {recettes.map(r => {
              const cout = coutRecette(r)
              const fc = foodCost(r)
              return (
                <div key={r.id} onClick={() => router.push(`/dashboard/recettes/${r.id}`)}
                  style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px 24px', cursor: 'pointer', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '16px' }}>{r.nom}</div>
                    <div style={{ color: '#8B9BB4', fontSize: '13px', marginTop: '4px' }}>{r.categorie || 'Sans catégorie'} · {r.recette_ingredients?.length || 0} ingrédients</div>
                  </div>
                  <div>
                    <div style={{ color: '#8B9BB4', fontSize: '12px', marginBottom: '2px' }}>Coût matière</div>
                    <div style={{ fontWeight: '700', color: '#00C2FF' }}>{cout.toFixed(2)}$</div>
                  </div>
                  <div>
                    <div style={{ color: '#8B9BB4', fontSize: '12px', marginBottom: '2px' }}>Prix vente</div>
                    <div style={{ fontWeight: '700' }}>{r.prix_vente ? r.prix_vente + '$' : '—'}</div>
                  </div>
                  <div>
                    <div style={{ color: '#8B9BB4', fontSize: '12px', marginBottom: '2px' }}>Food cost</div>
                    <div style={{ fontWeight: '700', color: fc ? couleurFC(fc) : '#8B9BB4' }}>{fc ? fc + '%' : '—'}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
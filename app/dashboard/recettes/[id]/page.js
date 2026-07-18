'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../../lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function DetailRecette() {
  const [form, setForm] = useState({ nom: '', prix_vente: '', categorie: '' })
  const [ingredients, setIngredients] = useState([])
  const [lignes, setLignes] = useState([])
  const [orgId, setOrgId] = useState(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')
    const { data: member } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).single()
    if (!member) return router.push('/dashboard/restaurant')
    setOrgId(member.organization_id)
    const { data: allIng } = await supabase.from('ingredients').select('*').eq('organization_id', member.organization_id).eq('archived', false).eq('hors_inventaire', false).order('nom')
    setIngredients(allIng || [])
    const { data: recette } = await supabase.from('recettes').select('*, recette_ingredients(id, ingredient_id, grammage)').eq('id', params.id).single()
    if (!recette) return router.push('/dashboard/recettes')
    setForm({ nom: recette.nom, prix_vente: recette.prix_vente || '', categorie: recette.categorie || '' })
    setLignes((recette.recette_ingredients || []).map(ri => ({ ingredient_id: ri.ingredient_id, grammage: ri.grammage })))
    setLoading(false)
  }

  function meilleurPrix(ing) {
    if (!ing?.ingredient_base) return null
    const groupe = ingredients.filter(i => i.ingredient_base === ing.ingredient_base)
    const moins_cher = groupe.reduce((min, i) => parseFloat(i.prix_unitaire) < parseFloat(min.prix_unitaire) ? i : min, ing)
    return moins_cher.id !== ing.id ? moins_cher : null
  }

  function coutTotal() {
    return lignes.reduce((acc, l) => {
      const ing = ingredients.find(i => i.id === l.ingredient_id)
      if (!ing || !l.grammage) return acc
      const f = (ing.unite === 'g' || ing.unite === 'ml') ? l.grammage / 1000 : parseFloat(l.grammage)
      return acc + (ing.prix_unitaire * f)
    }, 0)
  }

  async function sauvegarder() {
    if (!form.nom) return
    await supabase.from('recettes').update({ ...form, prix_vente: parseFloat(form.prix_vente) || null }).eq('id', params.id)
    await supabase.from('recette_ingredients').delete().eq('recette_id', params.id)
    const lignesValides = lignes.filter(l => l.ingredient_id && l.grammage)
    if (lignesValides.length > 0) await supabase.from('recette_ingredients').insert(lignesValides.map(l => ({ recette_id: params.id, ingredient_id: l.ingredient_id, grammage: parseFloat(l.grammage) })))
    router.push('/dashboard/recettes')
  }

  async function supprimer() {
    if (!window.confirm('Supprimer cette recette ?')) return
    await supabase.from('recette_ingredients').delete().eq('recette_id', params.id)
    await supabase.from('recettes').delete().eq('id', params.id)
    router.push('/dashboard/recettes')
  }

  const inp = { width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'inherit', fontSize: '14px', boxSizing: 'border-box' }
  const cout = coutTotal()
  const fc = form.prix_vente && cout ? ((cout / parseFloat(form.prix_vente)) * 100).toFixed(1) : null

  if (loading) return <p style={{ color: 'var(--muted)' }}>Chargement...</p>

  return (
    <div style={{ maxWidth: '700px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>{form.nom}</h1>
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Modifier la recette</p>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={() => router.push('/dashboard/recettes')} style={{ padding: '8px 16px', borderRadius: '8px', background: 'transparent', border: '1px solid var(--border)', color: 'inherit', cursor: 'pointer', fontSize: '13px' }}>← Retour</button>
          <button onClick={supprimer} style={{ padding: '8px 16px', borderRadius: '8px', background: 'transparent', border: '1px solid #FF4D6D', color: '#FF4D6D', cursor: 'pointer', fontSize: '13px' }}>🗑️ Supprimer</button>
        </div>
      </div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
          <div><label style={{ color: 'var(--muted)', fontSize: '12px', display: 'block', marginBottom: '6px' }}>NOM *</label><input value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} style={inp} /></div>
          <div><label style={{ color: 'var(--muted)', fontSize: '12px', display: 'block', marginBottom: '6px' }}>PRIX DE VENTE ($)</label><input type="number" value={form.prix_vente} onChange={e => setForm({ ...form, prix_vente: e.target.value })} style={inp} /></div>
          <div><label style={{ color: 'var(--muted)', fontSize: '12px', display: 'block', marginBottom: '6px' }}>CATÉGORIE</label>
            <select value={form.categorie} onChange={e => setForm({ ...form, categorie: e.target.value })} style={inp}>
              {['','Entrée','Plat principal','Dessert','Boisson','Accompagnement'].map(c => <option key={c} value={c}>{c || 'Choisir...'}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
        <p style={{ color: 'var(--muted)', fontSize: '12px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Ingrédients</p>
        {lignes.map((l, i) => {
          const ing = ingredients.find(x => x.id === l.ingredient_id)
          const alt = ing ? meilleurPrix(ing) : null
          return (
            <div key={i} style={{ marginBottom: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 40px', gap: '10px' }}>
                <select value={l.ingredient_id} onChange={e => { const n = [...lignes]; n[i].ingredient_id = e.target.value; setLignes(n) }} style={inp}>
                  <option value="">Choisir...</option>
                  {ingredients.map(o => <option key={o.id} value={o.id}>{o.nom} ({o.unite})</option>)}
                </select>
                <input type="number" placeholder="Quantité" value={l.grammage} onChange={e => { const n = [...lignes]; n[i].grammage = e.target.value; setLignes(n) }} style={inp} />
                <button onClick={() => setLignes(lignes.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#FF4D6D', cursor: 'pointer', fontSize: '20px' }}>×</button>
              </div>
              {ing && (
                <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '4px', marginLeft: '2px' }}>
                  {ing.fournisseur || 'Sans fournisseur'} · {parseFloat(ing.prix_unitaire).toFixed(2)}$/{ing.unite}
                  {alt && <span style={{ color: '#F5A623' }}> · ⚠️ moins cher chez {alt.fournisseur} : {parseFloat(alt.prix_unitaire).toFixed(2)}$/{alt.unite}</span>}
                </p>
              )}
            </div>
          )
        })}
        <button onClick={() => setLignes([...lignes, { ingredient_id: '', grammage: '' }])} style={{ padding: '7px 16px', borderRadius: '8px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', fontSize: '13px' }}>+ Ajouter ingrédient</button>
      </div>

      {cout > 0 && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', textAlign: 'center' }}>
          <div><div style={{ color: 'var(--muted)', fontSize: '12px', marginBottom: '4px' }}>COÛT MATIÈRE</div><div style={{ fontWeight: '700', fontSize: '20px', color: '#00C2FF' }}>{cout.toFixed(2)}$</div></div>
          <div><div style={{ color: 'var(--muted)', fontSize: '12px', marginBottom: '4px' }}>PRIX DE VENTE</div><div style={{ fontWeight: '700', fontSize: '20px' }}>{form.prix_vente ? `${parseFloat(form.prix_vente).toFixed(2)}$` : '—'}</div></div>
          <div><div style={{ color: 'var(--muted)', fontSize: '12px', marginBottom: '4px' }}>FOOD COST</div><div style={{ fontWeight: '700', fontSize: '20px', color: fc ? (fc <= 30 ? '#00E5A0' : fc <= 35 ? '#F5A623' : '#FF4D6D') : 'var(--muted)' }}>{fc ? `${fc}%` : '—'}</div></div>
        </div>
      )}

      <button onClick={sauvegarder} disabled={!form.nom} style={{ width: '100%', padding: '12px', borderRadius: '8px', background: form.nom ? '#00C2FF' : 'var(--border)', color: form.nom ? '#0A0F1E' : 'var(--muted)', fontWeight: '700', border: 'none', cursor: form.nom ? 'pointer' : 'default' }}>
        Sauvegarder les modifications
      </button>
    </div>
  )
}

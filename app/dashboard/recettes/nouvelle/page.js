'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function NouvelleRecette() {
  const [form, setForm] = useState({ nom: '', prix_vente: '', categorie: '' })
  const [ingredients, setIngredients] = useState([])
  const [lignes, setLignes] = useState([{ ingredient_id: '', grammage: '' }])
  const [orgId, setOrgId] = useState(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')
    const { data: member } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).single()
    if (!member) return router.push('/dashboard/restaurant')
    setOrgId(member.organization_id)
    const { data } = await supabase.from('ingredients').select('*').eq('organization_id', member.organization_id).order('nom')
    setIngredients(data || [])
  }

  function coutTotal() {
    return lignes.reduce((acc, l) => {
      const ing = ingredients.find(i => i.id === l.ingredient_id)
      if (!ing || !l.grammage) return acc
      const facteur = (ing.unite === 'g' || ing.unite === 'ml') ? l.grammage / 1000 : parseFloat(l.grammage)
      return acc + (ing.prix_unitaire * facteur)
    }, 0)
  }

  function foodCost() {
    const cout = coutTotal()
    if (!form.prix_vente || cout === 0) return null
    return ((cout / parseFloat(form.prix_vente)) * 100).toFixed(1)
  }

  async function sauvegarder() {
    if (!form.nom) return
    setLoading(true)
    const { data: recette } = await supabase.from('recettes').insert({ ...form, organization_id: orgId, prix_vente: parseFloat(form.prix_vente) || null }).select().single()
    const lignesValides = lignes.filter(l => l.ingredient_id && l.grammage)
    if (lignesValides.length > 0) {
      await supabase.from('recette_ingredients').insert(lignesValides.map(l => ({ recette_id: recette.id, ingredient_id: l.ingredient_id, grammage: parseFloat(l.grammage) })))
    }
    router.push('/dashboard/recettes')
  }

  const inp = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #1F2937', background: '#1F2937', color: 'white', fontSize: '14px', boxSizing: 'border-box' }
  const fc = foodCost()
  const cout = coutTotal()

  return (
    <div style={{ minHeight: '100vh', background: '#0A0F1E', color: 'white', fontFamily: 'sans-serif' }}>
      <div style={{ background: '#111827', borderBottom: '1px solid rgba(0,194,255,0.15)', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ color: '#00C2FF', fontWeight: '800', fontSize: '24px', margin: 0, cursor: 'pointer' }} onClick={() => router.push('/dashboard')}>PILOTE</h1>
        <span onClick={() => router.push('/dashboard/recettes')} style={{ color: '#8B9BB4', fontSize: '14px', cursor: 'pointer' }}>← Retour</span>
      </div>

      <div style={{ maxWidth: '700px', margin: '40px auto', padding: '0 24px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '32px' }}>✨ Nouvelle recette</h2>

        <div style={{ background: '#111827', border: '1px solid rgba(0,194,255,0.15)', borderRadius: '16px', padding: '24px', marginBottom: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ color: '#8B9BB4', fontSize: '12px', display: 'block', marginBottom: '6px' }}>NOM *</label>
              <input placeholder="Ex: Burger Classic" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} style={inp} />
            </div>
            <div>
              <label style={{ color: '#8B9BB4', fontSize: '12px', display: 'block', marginBottom: '6px' }}>PRIX DE VENTE ($)</label>
              <input type="number" placeholder="0.00" value={form.prix_vente} onChange={e => setForm({ ...form, prix_vente: e.target.value })} style={inp} />
            </div>
            <div>
              <label style={{ color: '#8B9BB4', fontSize: '12px', display: 'block', marginBottom: '6px' }}>CATÉGORIE</label>
              <select value={form.categorie} onChange={e => setForm({ ...form, categorie: e.target.value })} style={inp}>
                {['', 'Entrée', 'Plat principal', 'Dessert', 'Boisson', 'Accompagnement'].map(c => <option key={c} value={c}>{c || 'Choisir...'}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={{ background: '#111827', border: '1px solid rgba(0,194,255,0.15)', borderRadius: '16px', padding: '24px', marginBottom: '16px' }}>
          <p style={{ color: '#8B9BB4', fontSize: '12px', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>Ingrédients</p>
          {lignes.map((l, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 40px', gap: '10px', marginBottom: '10px' }}>
              <select value={l.ingredient_id} onChange={e => { const n = [...lignes]; n[i].ingredient_id = e.target.value; setLignes(n) }} style={inp}>
                <option value="">Choisir un ingrédient...</option>
                {ingredients.map(ing => <option key={ing.id} value={ing.id}>{ing.nom} ({ing.unite})</option>)}
              </select>
              <input type="number" placeholder="Quantité" value={l.grammage} onChange={e => { const n = [...lignes]; n[i].grammage = e.target.value; setLignes(n) }} style={inp} />
              <button onClick={() => setLignes(lignes.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#FF4D6D', cursor: 'pointer', fontSize: '20px' }}>×</button>
            </div>
          ))}
          <button onClick={() => setLignes([...lignes, { ingredient_id: '', grammage: '' }])}
            style={{ padding: '8px 16px', borderRadius: '8px', background: 'transparent', border: '1px solid #1F2937', color: '#8B9BB4', cursor: 'pointer', fontSize: '13px' }}>
            + Ajouter un ingrédient
          </button>
        </div>

        {cout > 0 && (
          <div style={{ background: '#111827', border: `1px solid ${fc && fc <= 30 ? '#00E5A030' : '#FF4D6D30'}`, borderRadius: '16px', padding: '20px 24px', marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div>
              <div style={{ color: '#8B9BB4', fontSize: '12px', marginBottom: '4px' }}>COÛT MATIÈRE</div>
              <div style={{ fontWeight: '700', fontSize: '20px', color: '#00C2FF' }}>{cout.toFixed(2)}$</div>
            </div>
            <div>
              <div style={{ color: '#8B9BB4', fontSize: '12px', marginBottom: '4px' }}>PRIX DE VENTE</div>
              <div style={{ fontWeight: '700', fontSize: '20px' }}>{form.prix_vente ? parseFloat(form.prix_vente).toFixed(2) + '$' : '—'}</div>
            </div>
            <div>
              <div style={{ color: '#8B9BB4', fontSize: '12px', marginBottom: '4px' }}>FOOD COST</div>
              <div style={{ fontWeight: '700', fontSize: '20px', color: fc ? (fc <= 30 ? '#00E5A0' : fc <= 35 ? '#F5A623' : '#FF4D6D') : '#8B9BB4' }}>{fc ? fc + '%' : '—'}</div>
            </div>
          </div>
        )}

        <button onClick={sauvegarder} disabled={loading || !form.nom}
          style={{ width: '100%', padding: '14px', borderRadius: '8px', background: form.nom ? '#00C2FF' : '#1F2937', color: form.nom ? '#0A0F1E' : '#8B9BB4', fontWeight: '700', border: 'none', cursor: form.nom ? 'pointer' : 'default', fontSize: '16px' }}>
          {loading ? 'Sauvegarde...' : 'Sauvegarder la recette'}
        </button>
      </div>
    </div>
  )
}
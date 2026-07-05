'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Ingredients() {
  const [ingredients, setIngredients] = useState([])
  const [form, setForm] = useState({ nom: '', unite: 'kg', prix_unitaire: '', fournisseur: '' })
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
    const { data } = await supabase.from('ingredients').select('*').eq('organization_id', member.organization_id).order('nom')
    setIngredients(data || [])
  }

  async function ajouter() {
    if (!form.nom || !form.prix_unitaire) return
    const { data } = await supabase.from('ingredients').insert({ ...form, organization_id: orgId, prix_unitaire: parseFloat(form.prix_unitaire) }).select().single()
    setIngredients([...ingredients, data])
    setForm({ nom: '', unite: 'kg', prix_unitaire: '', fournisseur: '' })
  }

  async function supprimer(id) {
    await supabase.from('ingredients').delete().eq('id', id)
    setIngredients(ingredients.filter(i => i.id !== id))
  }

  const inp = { width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'inherit', fontSize: '14px', boxSizing: 'border-box' }

  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>Ingrédients</h1>
      <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '28px' }}>Gérez vos ingrédients et prix fournisseurs</p>

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
        <p style={{ color: 'var(--muted)', fontSize: '12px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Ajouter un ingrédient</p>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr auto', gap: '12px', alignItems: 'end' }}>
          <input placeholder="Nom *" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} style={inp} />
          <select value={form.unite} onChange={e => setForm({ ...form, unite: e.target.value })} style={inp}>
            {['kg','g','L','ml','unité','portion'].map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <input placeholder="Prix *" type="number" value={form.prix_unitaire} onChange={e => setForm({ ...form, prix_unitaire: e.target.value })} style={inp} />
          <input placeholder="Fournisseur" value={form.fournisseur} onChange={e => setForm({ ...form, fournisseur: e.target.value })} style={inp} />
          <button onClick={ajouter} style={{ padding: '8px 20px', borderRadius: '8px', background: '#00C2FF', color: '#0A0F1E', fontWeight: '700', border: 'none', cursor: 'pointer' }}>+ Ajouter</button>
        </div>
      </div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr 40px', padding: '10px 20px', borderBottom: '1px solid var(--border)' }}>
          {['Nom','Unité','Prix','Fournisseur',''].map((h, i) => <span key={i} style={{ color: 'var(--muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>{h}</span>)}
        </div>
        {ingredients.length === 0 && <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '32px' }}>Aucun ingrédient</p>}
        {ingredients.map(ing => (
          <div key={ing.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr 40px', padding: '12px 20px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
            <span style={{ fontWeight: '500' }}>{ing.nom}</span>
            <span style={{ color: 'var(--muted)', fontSize: '13px' }}>{ing.unite}</span>
            <span style={{ color: '#00E5A0', fontSize: '13px' }}>{parseFloat(ing.prix_unitaire).toFixed(2)}$</span>
            <span style={{ color: 'var(--muted)', fontSize: '13px' }}>{ing.fournisseur || '—'}</span>
            <button onClick={() => supprimer(ing.id)} style={{ background: 'none', border: 'none', color: '#FF4D6D', cursor: 'pointer', fontSize: '18px' }}>×</button>
          </div>
        ))}
      </div>
    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../../lib/supabase'
import { useRouter } from 'next/navigation'

const CATEGORIES = ['Viandes','Produits laitiers','Légumes','Fruits','Épicerie','Boissons','Surgelés','Boulangerie','Poissons','Laitiers','Produits secs','Frais','Congelés','Autre']

export default function NouvelIngredient() {
  const [form, setForm] = useState({ nom:'', marque:'', code_produit:'', categorie:'', fournisseur:'', fournisseur_prefere:'', unite:'kg', prix_unitaire:'', prix_achat:'', qte_achetee:'', notes:'' })
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
  }

  async function sauvegarder() {
    if (!form.nom || !form.prix_unitaire) return
    setLoading(true)
    await supabase.from('ingredients').insert({ ...form, organization_id: orgId, prix_unitaire: parseFloat(form.prix_unitaire), prix_achat: form.prix_achat ? parseFloat(form.prix_achat) : null })
    router.push('/dashboard/ingredients')
  }

  const inp = { width:'100%', padding:'8px 12px', borderRadius:'8px', border:'1px solid var(--border)', background:'transparent', color:'inherit', fontSize:'14px', boxSizing:'border-box' }
  const card = { background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', padding:'20px', marginBottom:'16px' }

  return (
    <div style={{ maxWidth:'700px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'28px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', marginBottom:'4px' }}>Nouvel ingrédient</h1>
          <p style={{ color:'var(--muted)', fontSize:'14px' }}>Ajouter un ingrédient manuellement</p>
        </div>
        <button onClick={() => router.push('/dashboard/ingredients')} style={{ padding:'8px 16px', borderRadius:'8px', background:'transparent', border:'1px solid var(--border)', color:'inherit', cursor:'pointer', fontSize:'13px' }}>← Retour</button>
      </div>

      <div style={card}>
        <p style={{ color:'var(--muted)', fontSize:'12px', marginBottom:'12px', textTransform:'uppercase', letterSpacing:'1px' }}>Identification</p>
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'12px', marginBottom:'12px' }}>
          <div><label style={{ color:'var(--muted)', fontSize:'12px', display:'block', marginBottom:'4px' }}>Nom *</label><input value={form.nom} onChange={e => setForm({...form, nom:e.target.value})} style={inp} /></div>
          <div><label style={{ color:'var(--muted)', fontSize:'12px', display:'block', marginBottom:'4px' }}>Marque</label><input value={form.marque} onChange={e => setForm({...form, marque:e.target.value})} style={inp} /></div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
          <div><label style={{ color:'var(--muted)', fontSize:'12px', display:'block', marginBottom:'4px' }}>Code produit</label><input value={form.code_produit} onChange={e => setForm({...form, code_produit:e.target.value})} style={inp} /></div>
          <div><label style={{ color:'var(--muted)', fontSize:'12px', display:'block', marginBottom:'4px' }}>Catégorie</label>
            <select value={form.categorie} onChange={e => setForm({...form, categorie:e.target.value})} style={inp}>
              <option value=''>Choisir...</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div style={card}>
        <p style={{ color:'var(--muted)', fontSize:'12px', marginBottom:'12px', textTransform:'uppercase', letterSpacing:'1px' }}>Fournisseur</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
          <div><label style={{ color:'var(--muted)', fontSize:'12px', display:'block', marginBottom:'4px' }}>Fournisseur</label><input value={form.fournisseur} onChange={e => setForm({...form, fournisseur:e.target.value})} style={inp} /></div>
          <div><label style={{ color:'var(--muted)', fontSize:'12px', display:'block', marginBottom:'4px' }}>Fournisseur préféré</label><input value={form.fournisseur_prefere} onChange={e => setForm({...form, fournisseur_prefere:e.target.value})} style={inp} /></div>
        </div>
      </div>

      <div style={card}>
        <p style={{ color:'var(--muted)', fontSize:'12px', marginBottom:'12px', textTransform:'uppercase', letterSpacing:'1px' }}>Prix & unités</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px', marginBottom:'12px' }}>
          <div><label style={{ color:'var(--muted)', fontSize:'12px', display:'block', marginBottom:'4px' }}>Unité *</label>
            <select value={form.unite} onChange={e => setForm({...form, unite:e.target.value})} style={inp}>
              {['kg','g','L','ml','unité','portion'].map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div><label style={{ color:'var(--muted)', fontSize:'12px', display:'block', marginBottom:'4px' }}>Prix/unité * ($)</label><input type="number" value={form.prix_unitaire} onChange={e => setForm({...form, prix_unitaire:e.target.value})} style={inp} /></div>
          <div><label style={{ color:'var(--muted)', fontSize:'12px', display:'block', marginBottom:'4px' }}>Prix achat ($)</label><input type="number" value={form.prix_achat} onChange={e => setForm({...form, prix_achat:e.target.value})} style={inp} /></div>
        </div>
        <div><label style={{ color:'var(--muted)', fontSize:'12px', display:'block', marginBottom:'4px' }}>Qté achetée</label><input placeholder="Ex: caisse 10kg" value={form.qte_achetee} onChange={e => setForm({...form, qte_achetee:e.target.value})} style={inp} /></div>
      </div>

      <div style={card}>
        <p style={{ color:'var(--muted)', fontSize:'12px', marginBottom:'12px', textTransform:'uppercase', letterSpacing:'1px' }}>Notes</p>
        <textarea value={form.notes} onChange={e => setForm({...form, notes:e.target.value})} rows={3} style={{ ...inp, resize:'vertical' }} />
      </div>

      <button onClick={sauvegarder} disabled={loading || !form.nom || !form.prix_unitaire} style={{ width:'100%', padding:'12px', borderRadius:'8px', background: form.nom && form.prix_unitaire ? '#00C2FF' : 'var(--border)', color: form.nom && form.prix_unitaire ? '#0A0F1E' : 'var(--muted)', fontWeight:'700', border:'none', cursor: form.nom && form.prix_unitaire ? 'pointer' : 'default' }}>
        {loading ? 'Sauvegarde...' : 'Sauvegarder'}
      </button>
    </div>
  )
}

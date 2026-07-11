cat > app/dashboard/ingredients/import/page.js << 'EOF'
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../../lib/supabase'
import { useRouter } from 'next/navigation'

const CATEGORIES = ['Viandes','Produits laitiers','Légumes','Fruits','Épicerie','Boissons','Surgelés','Boulangerie','Poissons','Autre']

export default function ImportFacture() {
  const [orgId, setOrgId] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [extraits, setExtraits] = useState([])
  const [selected, setSelected] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
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

  async function onFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setError('')
    setExtraits([])
    setSelected([])
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result
      setPreview(dataUrl)
      setLoading(true)
      try {
        const res = await fetch('/api/facture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: dataUrl }) })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erreur analyse')
        const items = (data.ingredients || []).map((it, i) => ({ ...it, _id: i }))
        setExtraits(items)
        setSelected(items.map(it => it._id))
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    reader.readAsDataURL(file)
  }

  function update(id, field, value) {
    setExtraits(prev => prev.map(it => it._id === id ? { ...it, [field]: value } : it))
  }

  async function importer() {
    const toInsert = extraits.filter(it => selected.includes(it._id)).map(({ _id, note, prix_unitaire_100g, ...rest }) => ({
      ...rest,
      organization_id: orgId,
      prix_achat: parseFloat(rest.prix_achat) || 0,
      qte_achetee: parseFloat(rest.qte_achetee) || 1,
      prix_unitaire: (parseFloat(rest.prix_achat) || 0) / (parseFloat(rest.qte_achetee) || 1),
      archived: false,
    }))
    if (!toInsert.length) return
    setSaving(true)
    await supabase.from('ingredients').insert(toInsert)
    router.push('/dashboard/ingredients')
  }

  const inp = { width:'100%', padding:'6px 8px', borderRadius:'6px', border:'1px solid var(--border)', background:'transparent', color:'inherit', fontSize:'13px', boxSizing:'border-box' }
  const card = { background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', padding:'20px', marginBottom:'16px' }

  return (
    <div style={{ maxWidth:'900px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'28px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', marginBottom:'4px' }}>Importer une facture</h1>
          <p style={{ color:'var(--muted)', fontSize:'14px' }}>Prends une photo ou choisis une image de ta facture</p>
        </div>
        <button onClick={() => router.push('/dashboard/ingredients')} style={{ padding:'8px 16px', borderRadius:'8px', background:'transparent', border:'1px solid var(--border)', color:'inherit', cursor:'pointer', fontSize:'13px' }}>← Retour</button>
      </div>

      <div style={card}>
        <input type="file" accept="image/*,.heic,.heif" capture="environment" onChange={onFile} style={inp} />
        {preview && <img src={preview} alt="" style={{ maxWidth:'240px', borderRadius:'8px', marginTop:'12px' }} />}
        {loading && <p style={{ color:'var(--muted)', marginTop:'12px' }}>Analyse en cours...</p>}
        {error && <p style={{ color:'#FF4D6D', marginTop:'12px' }}>{error}</p>}
      </div>

      {extraits.length > 0 && (
        <div style={card}>
          <p style={{ color:'var(--muted)', fontSize:'12px', marginBottom:'12px', textTransform:'uppercase', letterSpacing:'1px' }}>{extraits.length} produits trouvés — vérifie avant d'importer</p>
          {extraits.map(it => (
            <div key={it._id} style={{ display:'grid', gridTemplateColumns:'24px 2fr 1fr 1fr 0.8fr 0.8fr 0.8fr', gap:'8px', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
              <input type="checkbox" checked={selected.includes(it._id)} onChange={e => setSelected(prev => e.target.checked ? [...prev, it._id] : prev.filter(id => id !== it._id))} />
              <input value={it.nom||''} onChange={e => update(it._id,'nom',e.target.value)} style={inp} placeholder="Nom" />
              <input value={it.fournisseur||''} onChange={e => update(it._id,'fournisseur',e.target.value)} style={inp} placeholder="Fournisseur" />
              <select value={it.categorie||''} onChange={e => update(it._id,'categorie',e.target.value)} style={inp}>
                <option value=''>Catégorie...</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <input type="number" value={it.prix_achat||''} onChange={e => update(it._id,'prix_achat',e.target.value)} style={inp} placeholder="Prix payé $" />
              <input type="number" value={it.qte_achetee||''} onChange={e => update(it._id,'qte_achetee',e.target.value)} style={inp} placeholder={'Qté ('+(it.unite||'kg')+')'} />
              <input value={it.format_achat||''} onChange={e => update(it._id,'format_achat',e.target.value)} style={inp} placeholder="Format" />
            </div>
          ))}
          <button onClick={importer} disabled={saving || !selected.length} style={{ marginTop:'16px', padding:'10px 20px', borderRadius:'8px', background: selected.length ? '#00C2FF' : 'var(--border)', color: selected.length ? '#0A0F1E' : 'var(--muted)', fontWeight:'700', border:'none', cursor: selected.length ? 'pointer' : 'default' }}>
            {saving ? 'Import...' : `Importer ${selected.length} ingrédient(s)`}
          </button>
        </div>
      )}
    </div>
  )
}
EOF
echo "✅ import/page.js remplacé"
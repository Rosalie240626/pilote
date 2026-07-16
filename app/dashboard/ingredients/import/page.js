'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../../lib/supabase'
import { useRouter } from 'next/navigation'

const CATEGORIES = ['Viandes','Produits laitiers','Légumes','Fruits','Épicerie','Boissons','Surgelés','Boulangerie','Poissons','Autre']

export default function ImportFacture() {
  const [orgId, setOrgId] = useState(null)
  const [ingredients, setIngredients] = useState([])
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [extraits, setExtraits] = useState([])
  const [selected, setSelected] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [conflitsImport, setConflitsImport] = useState(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')
    const { data: member } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).single()
    if (!member) return router.push('/dashboard/restaurant')
    setOrgId(member.organization_id)
    const { data: ing } = await supabase.from('ingredients').select('*').eq('organization_id', member.organization_id).eq('archived', false)
    setIngredients(ing || [])
  }

  function convertirEnJpeg(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        canvas.getContext('2d').drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/jpeg', 0.92))
      }
      img.onerror = () => reject(new Error("Impossible de lire cette image (format non supporté par le navigateur)"))
      img.src = dataUrl
    })
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
        const jpegUrl = await convertirEnJpeg(dataUrl)
        const res = await fetch('/api/facture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: jpegUrl }) })
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

  function champsDe(it) {
    const { _id, note, prix_unitaire_100g, ...rest } = it
    const prix_achat = parseFloat(rest.prix_achat) || 0
    const qte_achetee = parseFloat(rest.qte_achetee) || 1
    return { ...rest, prix_achat, qte_achetee, prix_unitaire: prix_achat / qte_achetee }
  }

  async function appliquerLignes(lignes) {
    for (const { it, existant } of lignes) {
      const champs = champsDe(it)
      if (existant) await supabase.from('ingredients').update(champs).eq('id', existant.id)
      else await supabase.from('ingredients').insert({ ...champs, organization_id: orgId, archived: false })
    }
  }

  async function importer() {
    const aInserer = extraits.filter(it => selected.includes(it._id))
    const conflits = [], aTraiter = []
    for (const it of aInserer) {
      const nomNorm = (it.nom||'').toLowerCase().trim()
      const existant = ingredients.find(i => i.nom.toLowerCase().trim() === nomNorm && (i.fournisseur||'') === (it.fournisseur||''))
      const nouveauPrix = champsDe(it).prix_unitaire
      if (existant && parseFloat(existant.prix_unitaire) !== nouveauPrix) conflits.push({ it, existant })
      else aTraiter.push({ it, existant })
    }
    setSaving(true)
    await appliquerLignes(aTraiter)
    setSaving(false)
    if (conflits.length > 0) setConflitsImport({ conflits, choix: conflits.map(() => 'remplacer') })
    else router.push('/dashboard/ingredients')
  }

  async function confirmerConflits() {
    const { conflits, choix } = conflitsImport
    for (let i = 0; i < conflits.length; i++) {
      const { it, existant } = conflits[i]
      const champs = champsDe(it)
      if (choix[i] === 'remplacer') {
        await supabase.from('ingredients_prix_historique').insert({ ingredient_id: existant.id, prix: existant.prix_unitaire })
        await supabase.from('ingredients').update(champs).eq('id', existant.id)
      } else {
        await supabase.from('ingredients').insert({ ...champs, organization_id: orgId, archived: false })
      }
    }
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

      {conflitsImport && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', padding:'24px', maxWidth:'600px', width:'90%', maxHeight:'80vh', overflowY:'auto' }}>
            <p style={{ fontWeight:'700', marginBottom:'16px' }}>{conflitsImport.conflits.length} changement(s) de prix détecté(s)</p>
            {conflitsImport.conflits.map((c, i) => (
              <div key={i} style={{ marginBottom:'14px', paddingBottom:'14px', borderBottom:'1px solid var(--border)' }}>
                <p style={{ fontSize:'14px', marginBottom:'8px' }}>{c.existant.nom} ({c.existant.fournisseur||'sans fournisseur'}) — {parseFloat(c.existant.prix_unitaire).toFixed(2)}$ → {champsDe(c.it).prix_unitaire.toFixed(2)}$</p>
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={() => setConflitsImport(prev => ({ ...prev, choix: prev.choix.map((v,j) => j===i ? 'remplacer' : v) }))} style={{ padding:'6px 12px', borderRadius:'6px', border:'1px solid '+(conflitsImport.choix[i]==='remplacer'?'#00C2FF':'var(--border)'), background: conflitsImport.choix[i]==='remplacer'?'rgba(0,194,255,0.15)':'transparent', color:'inherit', cursor:'pointer', fontSize:'12px' }}>Remplacer le prix</button>
                  <button onClick={() => setConflitsImport(prev => ({ ...prev, choix: prev.choix.map((v,j) => j===i ? 'nouveau' : v) }))} style={{ padding:'6px 12px', borderRadius:'6px', border:'1px solid '+(conflitsImport.choix[i]==='nouveau'?'#00C2FF':'var(--border)'), background: conflitsImport.choix[i]==='nouveau'?'rgba(0,194,255,0.15)':'transparent', color:'inherit', cursor:'pointer', fontSize:'12px' }}>Créer un ingrédient séparé</button>
                </div>
              </div>
            ))}
            <div style={{ display:'flex', gap:'10px', marginTop:'16px' }}>
              <button onClick={confirmerConflits} style={{ flex:1, padding:'10px', borderRadius:'8px', background:'#00C2FF', color:'#0A0F1E', fontWeight:'700', border:'none', cursor:'pointer' }}>Confirmer l'import</button>
              <button onClick={() => router.push('/dashboard/ingredients')} style={{ flex:1, padding:'10px', borderRadius:'8px', background:'transparent', border:'1px solid var(--border)', color:'inherit', cursor:'pointer' }}>Ignorer ces changements</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

const CATEGORIES = ['Viandes','Produits laitiers','Légumes','Fruits','Épicerie','Boissons','Surgelés','Boulangerie','Poissons','Autre']
const CAT_COLORS = { 'Viandes':'#FF4D6D','Produits laitiers':'#F5A623','Légumes':'#00E5A0','Fruits':'#FF8C42','Épicerie':'#00C2FF','Boissons':'#B47FFF','Surgelés':'#64B5F6','Boulangerie':'#FFD54F','Poissons':'#4FC3F7','Autre':'#8B9BB4' }

export default function Ingredients() {
  const [ingredients, setIngredients] = useState([])
  const [orgId, setOrgId] = useState(null)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [sort, setSort] = useState({ field:'nom', dir:'asc' })
  const [selected, setSelected] = useState([])
  const [editMode, setEditMode] = useState(false)
  const [drawerIng, setDrawerIng] = useState(null)
  const [drawerData, setDrawerData] = useState(null)
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const perPage = 25
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')
    const { data: member } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).single()
    if (!member) return router.push('/dashboard/restaurant')
    setOrgId(member.organization_id)
    const { data } = await supabase.from('ingredients').select('*').eq('organization_id', member.organization_id).eq('archived', false).order('nom')
    setIngredients((data || []).filter(Boolean))
  }

  async function reload(oid) {
    const { data } = await supabase.from('ingredients').select('*').eq('organization_id', oid || orgId).eq('archived', false).order('nom')
    setIngredients((data || []).filter(Boolean))
  }

  const filtered = useMemo(() => {
    let list = ingredients.filter(Boolean)
    if (search) { const q = search.toLowerCase(); list = list.filter(i => [i.nom,i.fournisseur,i.marque,i.code_produit,i.categorie].some(f => f?.toLowerCase().includes(q))) }
    if (filters.categorie) list = list.filter(i => i.categorie === filters.categorie)
    if (filters.fournisseur) list = list.filter(i => i.fournisseur?.toLowerCase().includes(filters.fournisseur.toLowerCase()))
    if (filters.unite) list = list.filter(i => i.unite === filters.unite)
    if (filters.prix_min) list = list.filter(i => parseFloat(i.prix_unitaire) >= parseFloat(filters.prix_min))
    if (filters.prix_max) list = list.filter(i => parseFloat(i.prix_unitaire) <= parseFloat(filters.prix_max))
    list.sort((a, b) => {
      if (!a || !b) return 0
      const av = sort.field === 'prix_unitaire' ? parseFloat(a[sort.field]||0) : String(a[sort.field]||'').toLowerCase()
      const bv = sort.field === 'prix_unitaire' ? parseFloat(b[sort.field]||0) : String(b[sort.field]||'').toLowerCase()
      return sort.dir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })
    return list
  }, [ingredients, search, filters, sort])

  const paginated = filtered.slice((page-1)*perPage, page*perPage)
  const totalPages = Math.ceil(filtered.length / perPage)
  const activeFilters = Object.keys(filters).filter(k => filters[k]).length

  function toggleSort(f) { setSort(s => ({ field:f, dir: s.field===f && s.dir==='asc' ? 'desc' : 'asc' })) }
  function sortIcon(f) { return sort.field!==f ? '↕' : sort.dir==='asc' ? '↑' : '↓' }

  async function openDrawer(ing) {
    setDrawerIng({...ing})
    const { data: hist } = await supabase.from('ingredients_prix_historique').select('*').eq('ingredient_id', ing.id).order('created_at', { ascending: false })
    const { data: rec } = await supabase.from('recette_ingredients').select('recettes(nom), grammage').eq('ingredient_id', ing.id)
    setDrawerData({ hist: hist||[], recettes: rec||[] })
  }

  async function saveDrawer() {
    await supabase.from('ingredients').update(drawerIng).eq('id', drawerIng.id)
    await reload()
    setDrawerIng(null)
    setToast('✓ Sauvegardé')
  }

  async function supprimer(id) {
    await supabase.from('ingredients').delete().eq('id', id)
    setIngredients(prev => prev.filter(i => i.id !== id))
    setToast('Supprimé')
  }

  async function dupliquer(ing) {
    const { id, created_at, ...rest } = ing
    const { data } = await supabase.from('ingredients').insert({...rest, nom: ing.nom+' (copie)'}).select().single()
    setIngredients(prev => [...prev, data].filter(Boolean))
    setToast('Dupliqué')
  }

  async function exportCSV() {
    const rows = [['Nom','Marque','Code','Catégorie','Fournisseur','Unité','Prix/kg','Prix/100g']]
    filtered.forEach(i => rows.push([i.nom,i.marque||'',i.code_produit||'',i.categorie||'',i.fournisseur||'',i.unite,parseFloat(i.prix_unitaire).toFixed(2),(parseFloat(i.prix_unitaire)/10).toFixed(4)]))
    const csv = rows.map(r => r.map(c => '"'+c+'"').join(',')).join('\n')
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv); a.download = 'ingredients.csv'; a.click()
    setToast('Export téléchargé')
  }

  const inp = { width:'100%', padding:'7px 10px', borderRadius:'6px', border:'1px solid var(--border)', background:'transparent', color:'inherit', fontSize:'13px', boxSizing:'border-box' }
  const gridCols = editMode ? '40px 2fr 1.5fr 1.5fr 0.7fr 1fr 0.8fr 80px' : '2fr 1.5fr 1.5fr 0.7fr 1fr 0.8fr'

  return (
    <div style={{ display:'flex', gap:'0' }}>
      {toast && <div style={{ position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%)', background:'#1a1f2e', border:'1px solid rgba(0,194,255,0.3)', borderRadius:'10px', padding:'12px 24px', color:'white', fontSize:'14px', zIndex:1000 }} onClick={() => setToast(null)}>{toast}</div>}

      {showFilters && (
        <div style={{ width:'220px', flexShrink:0, background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', padding:'16px', marginRight:'16px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'12px' }}>
            <span style={{ fontWeight:'600', fontSize:'14px' }}>Filtres</span>
            <button onClick={() => setFilters({})} style={{ background:'none', border:'none', color:'#FF4D6D', cursor:'pointer', fontSize:'12px' }}>Effacer</button>
          </div>
          {[{l:'Catégorie',k:'categorie',t:'select',o:CATEGORIES},{l:'Fournisseur',k:'fournisseur',t:'text'},{l:'Unité',k:'unite',t:'select',o:['kg','g','L','ml','unité','portion']},{l:'Prix min',k:'prix_min',t:'number'},{l:'Prix max',k:'prix_max',t:'number'}].map(f => (
            <div key={f.k} style={{ marginBottom:'8px' }}>
              <label style={{ color:'var(--muted)', fontSize:'11px', display:'block', marginBottom:'3px' }}>{f.l}</label>
              {f.t==='select' ? <select value={filters[f.k]||''} onChange={e => setFilters({...filters,[f.k]:e.target.value})} style={inp}><option value=''>Tous</option>{f.o.map(o => <option key={o}>{o}</option>)}</select>
              : <input type={f.t} value={filters[f.k]||''} onChange={e => setFilters({...filters,[f.k]:e.target.value})} style={inp} />}
            </div>
          ))}
        </div>
      )}

      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div>
            <h1 style={{ fontSize:'22px', fontWeight:'700', marginBottom:'4px' }}>Ingrédients</h1>
            <p style={{ color:'var(--muted)', fontSize:'14px' }}>{filtered.length} ingrédient{filtered.length>1?'s':''}</p>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={exportCSV} style={{ padding:'8px 14px', borderRadius:'8px', background:'transparent', border:'1px solid var(--border)', color:'inherit', cursor:'pointer', fontSize:'13px' }}>⬇ Export</button>
            <button onClick={() => router.push('/dashboard/ingredients/import')} style={{ padding:'8px 14px', borderRadius:'8px', background:'transparent', border:'1px solid var(--border)', color:'inherit', cursor:'pointer', fontSize:'13px' }}>📸 Importer</button>
            <button onClick={() => setEditMode(!editMode)} style={{ padding:'8px 14px', borderRadius:'8px', background: editMode?'rgba(0,194,255,0.1)':'transparent', border:'1px solid '+(editMode?'#00C2FF':'var(--border)'), color: editMode?'#00C2FF':'inherit', cursor:'pointer', fontSize:'13px' }}>✏️ Modifier</button>
            <button onClick={() => router.push('/dashboard/ingredients/nouveau')} style={{ padding:'8px 16px', borderRadius:'8px', background:'#00C2FF', color:'#0A0F1E', fontWeight:'700', border:'none', cursor:'pointer', fontSize:'13px' }}>+ Ajouter</button>
          </div>
        </div>

        <div style={{ display:'flex', gap:'10px', marginBottom:'16px' }}>
          <div style={{ flex:1, position:'relative' }}>
            <span style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'var(--muted)' }}>🔍</span>
            <input placeholder="Rechercher..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} style={{ width:'100%', padding:'9px 12px 9px 36px', borderRadius:'8px', border:'1px solid var(--border)', background:'var(--card)', color:'inherit', fontSize:'14px', boxSizing:'border-box' }} />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} style={{ padding:'8px 16px', borderRadius:'8px', background: showFilters?'rgba(0,194,255,0.1)':'transparent', border:'1px solid '+(showFilters?'#00C2FF':'var(--border)'), color: showFilters?'#00C2FF':'inherit', cursor:'pointer', fontSize:'13px' }}>
            ⚙ Filtres{activeFilters>0?' ('+activeFilters+')':''}
          </button>
        </div>

        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:gridCols, padding:'10px 16px', borderBottom:'1px solid var(--border)' }}>
            {editMode && <input type="checkbox" checked={selected.length===paginated.length && paginated.length>0} onChange={e => setSelected(e.target.checked ? paginated.map(i=>i.id) : [])} style={{ cursor:'pointer' }} />}
            {[['nom','Nom'],['categorie','Catégorie'],['fournisseur','Fournisseur'],['unite','Unité'],['prix_unitaire','Prix/kg'],['','Prix/100g']].map(([f,l]) => (
              <span key={l} onClick={() => f && toggleSort(f)} style={{ color:'var(--muted)', fontSize:'12px', textTransform:'uppercase', letterSpacing:'1px', cursor:f?'pointer':'default' }}>
                {l}{f?' '+sortIcon(f):''}
              </span>
            ))}
            {editMode && <span style={{ color:'var(--muted)', fontSize:'12px', textTransform:'uppercase', letterSpacing:'1px' }}>Actions</span>}
          </div>

          {paginated.length===0 && <p style={{ color:'var(--muted)', textAlign:'center', padding:'32px' }}>Aucun ingrédient</p>}

          {paginated.map(ing => {
            if (!ing) return null
            const catColor = CAT_COLORS[ing.categorie] || '#8B9BB4'
            const isSel = selected.includes(ing.id)
            return (
              <div key={ing.id} style={{ display:'grid', gridTemplateColumns:gridCols, padding:'12px 16px', borderBottom:'1px solid var(--border)', alignItems:'center', background: isSel?'rgba(0,194,255,0.04)':'transparent' }}
                onMouseEnter={e => { if(!isSel) e.currentTarget.style.background='var(--hover)' }}
                onMouseLeave={e => { if(!isSel) e.currentTarget.style.background='transparent' }}>
                {editMode && <input type="checkbox" checked={isSel} onChange={e => setSelected(prev => e.target.checked?[...prev,ing.id]:prev.filter(id=>id!==ing.id))} style={{ cursor:'pointer' }} />}
                <div>
                  <div style={{ fontWeight:'500', fontSize:'14px' }}>{ing.nom}</div>
                  {ing.marque && <div style={{ color:'var(--muted)', fontSize:'12px' }}>{ing.marque}{ing.code_produit?' · '+ing.code_produit:''}</div>}
                </div>
                <span style={{ fontSize:'12px', color:catColor, fontWeight:'600' }}>{ing.categorie||'—'}</span>
                <span style={{ color:'var(--muted)', fontSize:'13px' }}>{ing.fournisseur||'—'}</span>
                <span style={{ color:'var(--muted)', fontSize:'13px' }}>{ing.unite}</span>
                <span style={{ color:'#00E5A0', fontSize:'13px' }}>{parseFloat(ing.prix_unitaire).toFixed(2)}$</span>
                <span style={{ color:'#00C2FF', fontSize:'13px' }}>{(parseFloat(ing.prix_unitaire)/10).toFixed(4)}$</span>
                {editMode && (
                  <div style={{ display:'flex', gap:'4px' }}>
                    <button onClick={() => openDrawer(ing)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'15px' }}>✏️</button>
                    <button onClick={() => dupliquer(ing)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'15px' }}>📋</button>
                    <button onClick={() => supprimer(ing.id)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'15px' }}>🗑️</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {totalPages>1 && (
          <div style={{ display:'flex', justifyContent:'center', gap:'8px', marginTop:'16px' }}>
            <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{ padding:'6px 14px', borderRadius:'6px', border:'1px solid var(--border)', background:'transparent', color:'inherit', cursor:'pointer' }}>←</button>
            <span style={{ padding:'6px 14px', color:'var(--muted)', fontSize:'13px' }}>{page} / {totalPages}</span>
            <button onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={{ padding:'6px 14px', borderRadius:'6px', border:'1px solid var(--border)', background:'transparent', color:'inherit', cursor:'pointer' }}>→</button>
          </div>
        )}
      </div>

      {drawerIng && (
        <div style={{ position:'fixed', top:0, right:0, bottom:0, width:'33vw', minWidth:'300px', background:'var(--card)', borderLeft:'1px solid var(--border)', zIndex:200, overflowY:'auto', padding:'24px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
            <span style={{ fontWeight:'700', fontSize:'16px' }}>Modifier</span>
            <button onClick={() => setDrawerIng(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontSize:'20px' }}>×</button>
          </div>
          {[{l:'Nom',k:'nom'},{l:'Marque',k:'marque'},{l:'Code produit',k:'code_produit'},{l:'Fournisseur',k:'fournisseur'}].map(f => (
            <div key={f.k} style={{ marginBottom:'10px' }}>
              <label style={{ color:'var(--muted)', fontSize:'11px', display:'block', marginBottom:'3px', textTransform:'uppercase' }}>{f.l}</label>
              <input value={drawerIng[f.k]||''} onChange={e => setDrawerIng({...drawerIng,[f.k]:e.target.value})} style={inp} />
            </div>
          ))}
          <div style={{ marginBottom:'10px' }}>
            <label style={{ color:'var(--muted)', fontSize:'11px', display:'block', marginBottom:'3px', textTransform:'uppercase' }}>Catégorie</label>
            <select value={drawerIng.categorie||''} onChange={e => setDrawerIng({...drawerIng,categorie:e.target.value})} style={inp}>
              <option value=''>Choisir...</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
            <div>
              <label style={{ color:'var(--muted)', fontSize:'11px', display:'block', marginBottom:'3px', textTransform:'uppercase' }}>Unité</label>
              <select value={drawerIng.unite||'kg'} onChange={e => setDrawerIng({...drawerIng,unite:e.target.value})} style={inp}>
                {['kg','g','L','ml','unité','portion'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label style={{ color:'var(--muted)', fontSize:'11px', display:'block', marginBottom:'3px', textTransform:'uppercase' }}>Prix ($)</label>
              <input type="number" value={drawerIng.prix_unitaire||''} onChange={e => setDrawerIng({...drawerIng,prix_unitaire:e.target.value})} style={inp} />
            </div>
          </div>
          <div style={{ marginBottom:'16px' }}>
            <label style={{ color:'var(--muted)', fontSize:'11px', display:'block', marginBottom:'3px', textTransform:'uppercase' }}>Notes</label>
            <textarea value={drawerIng.notes||''} onChange={e => setDrawerIng({...drawerIng,notes:e.target.value})} rows={3} style={{...inp,resize:'vertical'}} />
          </div>
          <div style={{ display:'flex', gap:'10px', marginBottom:'20px' }}>
            <button onClick={saveDrawer} style={{ flex:1, padding:'10px', borderRadius:'8px', background:'#00C2FF', color:'#0A0F1E', fontWeight:'700', border:'none', cursor:'pointer' }}>Sauvegarder</button>
            <button onClick={() => setDrawerIng(null)} style={{ flex:1, padding:'10px', borderRadius:'8px', background:'transparent', border:'1px solid var(--border)', color:'inherit', cursor:'pointer' }}>Annuler</button>
          </div>
          {drawerData?.recettes?.length > 0 && (
            <div style={{ marginBottom:'16px' }}>
              <p style={{ color:'var(--muted)', fontSize:'11px', marginBottom:'8px', textTransform:'uppercase' }}>Recettes liées</p>
              {drawerData.recettes.map((ri,i) => <div key={i} style={{ padding:'6px 0', borderBottom:'1px solid var(--border)', fontSize:'13px' }}>{ri.recettes?.nom}</div>)}
            </div>
          )}
          {drawerData?.hist?.length > 0 && (
            <div>
              <p style={{ color:'var(--muted)', fontSize:'11px', marginBottom:'8px', textTransform:'uppercase' }}>Historique des prix</p>
              {drawerData.hist.slice(0,10).map((h,i) => (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', padding:'6px 0', borderBottom:'1px solid var(--border)', fontSize:'12px' }}>
                  <span style={{ color:'#00E5A0' }}>{parseFloat(h.prix).toFixed(2)}$</span>
                  <span style={{ color:'var(--muted)' }}>{h.source}</span>
                  <span style={{ color:'var(--muted)' }}>{new Date(h.created_at).toLocaleDateString('fr-CA')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

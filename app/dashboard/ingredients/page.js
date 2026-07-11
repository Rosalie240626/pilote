'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts'
import * as XLSX from 'xlsx'

const CATEGORIES = ['Viandes','Produits laitiers','Légumes','Fruits','Épicerie','Boissons','Surgelés','Boulangerie','Poissons','Autre']
const CAT_COLORS = { 'Viandes':'#FF4D6D','Produits laitiers':'#F5A623','Légumes':'#00E5A0','Fruits':'#FF8C42','Épicerie':'#00C2FF','Boissons':'#B47FFF','Surgelés':'#64B5F6','Boulangerie':'#FFD54F','Poissons':'#4FC3F7','Autre':'#8B9BB4' }
const FOURNISSEUR_COLORS = ['#00C2FF','#00E5A0','#F5A623','#FF4D6D','#B47FFF','#FF8C42']

export default function Ingredients() {
  const [ingredients, setIngredients] = useState([])
  const [historique, setHistorique] = useState([])
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
  const [onglet, setOnglet] = useState('liste')
  const [ingFournisseur, setIngFournisseur] = useState('')
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
    const { data: hist } = await supabase.from('ingredients_prix_historique').select('*, ingredients(nom, fournisseur)').order('created_at', { ascending: true })
    setHistorique(hist || [])
  }

  async function reload() {
    const { data } = await supabase.from('ingredients').select('*').eq('organization_id', orgId).eq('archived', false).order('nom')
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

  const fournisseurs = useMemo(() => [...new Set(ingredients.filter(Boolean).map(i => i.fournisseur).filter(Boolean))], [ingredients])

  const groupesExistants = useMemo(() => [...new Set(ingredients.filter(Boolean).map(i => i.ingredient_base).filter(Boolean))], [ingredients])

  const comparaisonData = useMemo(() => {
    const groupes = [...new Set(ingredients.filter(Boolean).map(i => i.ingredient_base || i.nom))]
    return groupes.map(groupe => {
      const row = { nom: groupe }
      ingredients.filter(i => i && (i.ingredient_base || i.nom) === groupe).forEach(i => { if (i.fournisseur) { row[i.fournisseur] = parseFloat(i.prix_unitaire); row[i.fournisseur+'_format'] = i.format_achat } })
      return row
    }).filter(r => Object.keys(r).length > 2)
  }, [ingredients])

  const historiqueFiltre = useMemo(() => {
    if (!ingFournisseur) return []
    return historique.filter(h => h.ingredients?.nom === ingFournisseur).map(h => ({
      date: new Date(h.created_at).toLocaleDateString('fr-CA'),
      prix: parseFloat(h.prix)
    }))
  }, [historique, ingFournisseur])

  function toggleSort(f) { setSort(s => ({ field:f, dir: s.field===f && s.dir==='asc' ? 'desc' : 'asc' })) }
  function sortIcon(f) { return sort.field!==f ? '↕' : sort.dir==='asc' ? '↑' : '↓' }

  async function openDrawer(ing) {
    setDrawerIng({...ing})
    const { data: hist } = await supabase.from('ingredients_prix_historique').select('*').eq('ingredient_id', ing.id).order('created_at', { ascending: true })
    const { data: rec } = await supabase.from('recette_ingredients').select('recettes(nom), grammage').eq('ingredient_id', ing.id)
    setDrawerData({ hist: hist||[], recettes: rec||[] })
  }

  async function saveDrawer() {
    const d = { ...drawerIng }
    if (d.prix_achat && d.qte_achetee) d.prix_unitaire = parseFloat(d.prix_achat) / parseFloat(d.qte_achetee)
    await supabase.from('ingredients').update(d).eq('id', d.id)
    await reload()
    setDrawerIng(null)
    setToast('✓ Sauvegardé')
  }

  async function supprimer(id) {
    if (!confirm('Supprimer cet ingrédient ?')) return
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

  async function importExcel(e) {
    const file = e.target.files[0]
    if (!file) return
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
    const toInsert = rows.filter(r => r.nom).map(r => ({
      organization_id: orgId,
      nom: String(r.nom),
      marque: r.marque ? String(r.marque) : null,
      code_produit: r.code_produit ? String(r.code_produit) : null,
      categorie: r.categorie || null,
      fournisseur: r.fournisseur || null,
      unite: r.unite || 'unité',
      prix_unitaire: parseFloat(r.prix_unitaire) || 0,
      prix_achat: parseFloat(r.prix_achat) || null,
      qte_achetee: parseFloat(r.qte_achetee) || null,
      notes: r.notes ? String(r.notes) : null,
      archived: false,
    }))
    e.target.value = ''
    if (!toInsert.length) return setToast('Aucune ligne valide trouvée')
    const { data, error } = await supabase.from('ingredients').insert(toInsert).select()
    if (error) return setToast('Erreur import: ' + error.message)
    await reload()
    setToast(`✓ ${data.length} ingrédients importés`)
  }

  async function exportCSV() {
    const rows = [['Nom','Marque','Code','Catégorie','Fournisseur','Unité','Prix/kg','Prix/100g']]
    filtered.forEach(i => rows.push([i.nom,i.marque||'',i.code_produit||'',i.categorie||'',i.fournisseur||'',i.unite,parseFloat(i.prix_unitaire).toFixed(2),(parseFloat(i.prix_unitaire)/10).toFixed(4)]))
    const csv = rows.map(r => r.map(c => '"'+c+'"').join(',')).join('\n')
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv); a.download = 'ingredients.csv'; a.click()
    setToast('Export téléchargé')
  }

  function petitPrix(ing) {
    const p = parseFloat(ing.prix_unitaire)
    if (!p) return '—'
    if (ing.unite === 'kg') return (p/10).toFixed(3)+'$/100g'
    if (ing.unite === 'L') return (p/10).toFixed(3)+'$/100ml'
    return '—'
  }

  const inp = { width:'100%', padding:'7px 10px', borderRadius:'6px', border:'1px solid var(--border)', background:'transparent', color:'inherit', fontSize:'13px', boxSizing:'border-box' }
  const gridCols = editMode ? '40px 2fr 1.5fr 1.5fr 0.7fr 1fr 0.8fr 80px' : '2fr 1.5fr 1.5fr 0.7fr 1fr 0.8fr'

  return (
    <div style={{ display:'flex', gap:'0' }}>
      {toast && <div style={{ position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%)', background:'#1a1f2e', border:'1px solid rgba(0,194,255,0.3)', borderRadius:'10px', padding:'12px 24px', color:'white', fontSize:'14px', zIndex:1000 }} onClick={() => setToast(null)}>{toast}</div>}

      {showFilters && onglet === 'liste' && (
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
            <input id="excel-input" type="file" accept=".xlsx,.xls" onChange={importExcel} style={{ display:'none' }} />
            <button onClick={() => document.getElementById('excel-input').click()} style={{ padding:'8px 14px', borderRadius:'8px', background:'transparent', border:'1px solid var(--border)', color:'inherit', cursor:'pointer', fontSize:'13px' }}>📊 Importer Excel</button>
            <button onClick={() => setEditMode(!editMode)} style={{ padding:'8px 14px', borderRadius:'8px', background: editMode?'rgba(0,194,255,0.1)':'transparent', border:'1px solid '+(editMode?'#00C2FF':'var(--border)'), color: editMode?'#00C2FF':'inherit', cursor:'pointer', fontSize:'13px' }}>✏️ Modifier</button>
            <button onClick={() => router.push('/dashboard/ingredients/nouveau')} style={{ padding:'8px 16px', borderRadius:'8px', background:'#00C2FF', color:'#0A0F1E', fontWeight:'700', border:'none', cursor:'pointer', fontSize:'13px' }}>+ Ajouter</button>
          </div>
        </div>

        {/* Onglets */}
        <div style={{ display:'flex', gap:'4px', marginBottom:'20px', borderBottom:'1px solid var(--border)', paddingBottom:'0' }}>
          {[['liste','📋 Liste'],['fournisseurs','🏪 Fournisseurs']].map(([k,l]) => (
            <button key={k} onClick={() => setOnglet(k)} style={{ padding:'8px 20px', borderRadius:'8px 8px 0 0', background: onglet===k ? 'var(--card)' : 'transparent', border: onglet===k ? '1px solid var(--border)' : '1px solid transparent', borderBottom: onglet===k ? '1px solid var(--card)' : '1px solid transparent', color: onglet===k ? 'inherit' : 'var(--muted)', cursor:'pointer', fontSize:'14px', marginBottom:'-1px' }}>
              {l}
            </button>
          ))}
        </div>

        {onglet === 'liste' && (
          <>
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
                {[['nom','Nom'],['categorie','Catégorie'],['fournisseur','Fournisseur'],['unite','Unité'],['prix_unitaire','Prix/unité'],['','Détail']].map(([f,l]) => (
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
                      <div style={{ fontWeight:'500', fontSize:'14px' }}>{ing.nom}{ing.ingredient_base && <span title={'Groupe: '+ing.ingredient_base} style={{ marginLeft:'8px', fontSize:'10px', padding:'2px 6px', borderRadius:'4px', background:'rgba(0,194,255,0.12)', color:'#00C2FF' }}>🔗 {ing.ingredient_base}</span>}</div>
                      {ing.marque && <div style={{ color:'var(--muted)', fontSize:'12px' }}>{ing.marque}{ing.code_produit?' · '+ing.code_produit:''}{ing.format_achat?' · '+ing.format_achat:''}</div>}
                    </div>
                    <span style={{ fontSize:'12px', color:catColor, fontWeight:'600' }}>{ing.categorie||'—'}</span>
                    <span style={{ color:'var(--muted)', fontSize:'13px' }}>{ing.fournisseur||'—'}</span>
                    <span style={{ color:'var(--muted)', fontSize:'13px' }}>{ing.unite}</span>
                    <span style={{ color:'#00E5A0', fontSize:'13px' }}>{parseFloat(ing.prix_unitaire).toFixed(2)}$</span>
                    <span style={{ color:'#00C2FF', fontSize:'13px' }}>{petitPrix(ing)}</span>
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
          </>
        )}

        {onglet === 'fournisseurs' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginBottom:'24px' }}>
              {/* Résumé par fournisseur */}
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', padding:'20px' }}>
                <p style={{ color:'var(--muted)', fontSize:'12px', marginBottom:'16px', textTransform:'uppercase', letterSpacing:'1px' }}>Résumé par fournisseur</p>
                {fournisseurs.map(f => {
                  const ings = ingredients.filter(i => i && i.fournisseur === f)
                  const prixMoyen = ings.reduce((acc, i) => acc + parseFloat(i.prix_unitaire), 0) / ings.length
                  return (
                    <div key={f} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontWeight:'600', fontSize:'14px' }}>{f}</div>
                        <div style={{ color:'var(--muted)', fontSize:'12px' }}>{ings.length} produit{ings.length>1?'s':''}</div>
                      </div>
                      <span style={{ color:'#00E5A0', fontSize:'14px', fontWeight:'600' }}>{prixMoyen.toFixed(2)}$ moy.</span>
                    </div>
                  )
                })}
                {fournisseurs.length === 0 && <p style={{ color:'var(--muted)', fontSize:'13px' }}>Aucun fournisseur enregistré</p>}
              </div>

              {/* Historique prix */}
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', padding:'20px' }}>
                <p style={{ color:'var(--muted)', fontSize:'12px', marginBottom:'12px', textTransform:'uppercase', letterSpacing:'1px' }}>Historique des prix</p>
                <select value={ingFournisseur} onChange={e => setIngFournisseur(e.target.value)} style={{ ...inp, marginBottom:'16px' }}>
                  <option value=''>Choisir un ingrédient...</option>
                  {[...new Set(ingredients.map(i => i?.nom).filter(Boolean))].sort().map(n => <option key={n}>{n}</option>)}
                </select>
                {historiqueFiltre.length > 0 ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={historiqueFiltre}>
                      <XAxis dataKey="date" tick={{ fontSize:10, fill:'#8B9BB4' }} />
                      <YAxis tick={{ fontSize:10, fill:'#8B9BB4' }} />
                      <Tooltip contentStyle={{ background:'#1a1f2e', border:'1px solid rgba(0,194,255,0.2)', borderRadius:'8px', fontSize:'12px' }} />
                      <Line type="monotone" dataKey="prix" stroke="#00C2FF" strokeWidth={2} dot={{ fill:'#00C2FF', r:4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <p style={{ color:'var(--muted)', fontSize:'13px', textAlign:'center', marginTop:'20px' }}>{ingFournisseur ? 'Aucun historique pour cet ingrédient' : 'Sélectionne un ingrédient'}</p>}
              </div>
            </div>

            {/* Tableau comparatif */}
            {comparaisonData.length > 0 && (
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', padding:'20px', marginBottom:'24px' }}>
                <p style={{ color:'var(--muted)', fontSize:'12px', marginBottom:'16px', textTransform:'uppercase', letterSpacing:'1px' }}>Comparaison prix par fournisseur</p>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                    <thead>
                      <tr style={{ borderBottom:'1px solid var(--border)' }}>
                        <th style={{ padding:'8px 12px', color:'var(--muted)', textAlign:'left', fontWeight:'600' }}>Ingrédient</th>
                        {fournisseurs.map(f => <th key={f} style={{ padding:'8px 12px', color:'var(--muted)', textAlign:'right', fontWeight:'600' }}>{f}</th>)}
                        <th style={{ padding:'8px 12px', color:'var(--muted)', textAlign:'right', fontWeight:'600' }}>Meilleur prix</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparaisonData.map((row, i) => {
                        const prix = fournisseurs.map(f => row[f]).filter(Boolean)
                        const min = Math.min(...prix)
                        return (
                          <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                            <td style={{ padding:'10px 12px', fontWeight:'500' }}>{row.nom}</td>
                            {fournisseurs.map(f => (
                              <td key={f} style={{ padding:'10px 12px', textAlign:'right', color: row[f] === min ? '#00E5A0' : 'inherit', fontWeight: row[f] === min ? '700' : '400' }}>
                                {row[f] ? <>{row[f].toFixed(2)}$<br/>{row[f+'_format'] && <span style={{ fontSize:'11px', color:'var(--muted)', fontWeight:'400' }}>{row[f+'_format']}</span>}</> : '—'}
                              </td>
                            ))}
                            <td style={{ padding:'10px 12px', textAlign:'right', color:'#00E5A0', fontWeight:'700' }}>{min.toFixed(2)}$</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Graphique barres */}
            {comparaisonData.length > 0 && fournisseurs.length > 1 && (
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', padding:'20px' }}>
                <p style={{ color:'var(--muted)', fontSize:'12px', marginBottom:'16px', textTransform:'uppercase', letterSpacing:'1px' }}>Graphique comparatif</p>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={comparaisonData.slice(0,10)}>
                    <XAxis dataKey="nom" tick={{ fontSize:10, fill:'#8B9BB4' }} />
                    <YAxis tick={{ fontSize:10, fill:'#8B9BB4' }} />
                    <Tooltip contentStyle={{ background:'#1a1f2e', border:'1px solid rgba(0,194,255,0.2)', borderRadius:'8px', fontSize:'12px' }} />
                    <Legend wrapperStyle={{ fontSize:'12px' }} />
                    {fournisseurs.map((f, i) => <Bar key={f} dataKey={f} fill={FOURNISSEUR_COLORS[i % FOURNISSEUR_COLORS.length]} radius={[4,4,0,0]} />)}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {comparaisonData.length === 0 && (
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', padding:'48px', textAlign:'center' }}>
                <p style={{ color:'var(--muted)', fontSize:'14px' }}>Aucune comparaison disponible — ajoutez le même ingrédient chez plusieurs fournisseurs pour voir la comparaison</p>
              </div>
            )}
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
            <label style={{ color:'var(--muted)', fontSize:'11px', display:'block', marginBottom:'3px', textTransform:'uppercase' }}>Regrouper sous (comparateur)</label>
            <input value={drawerIng.ingredient_base||''} onChange={e => setDrawerIng({...drawerIng,ingredient_base:e.target.value})} list="groupes-list" placeholder="ex: Bacon" style={inp} />
            <datalist id="groupes-list">{groupesExistants.map(g => <option key={g} value={g} />)}</datalist>
          </div>
          <div style={{ marginBottom:'10px' }}>
            <label style={{ color:'var(--muted)', fontSize:'11px', display:'block', marginBottom:'3px', textTransform:'uppercase' }}>Catégorie</label>
            <select value={drawerIng.categorie||''} onChange={e => setDrawerIng({...drawerIng,categorie:e.target.value})} style={inp}>
              <option value=''>Choisir...</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
            <div>
              <label style={{ color:'var(--muted)', fontSize:'11px', display:'block', marginBottom:'3px', textTransform:'uppercase' }}>Unité de base</label>
              <select value={drawerIng.unite||'kg'} onChange={e => setDrawerIng({...drawerIng,unite:e.target.value})} style={inp}>
                {['kg','g','L','ml','unité','portion'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label style={{ color:'var(--muted)', fontSize:'11px', display:'block', marginBottom:'3px', textTransform:'uppercase' }}>Format d'achat</label>
              <input value={drawerIng.format_achat||''} onChange={e => setDrawerIng({...drawerIng,format_achat:e.target.value})} placeholder="ex: poche 20kg, 4x3 unités" style={inp} />
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'6px' }}>
            <div>
              <label style={{ color:'var(--muted)', fontSize:'11px', display:'block', marginBottom:'3px', textTransform:'uppercase' }}>Prix d'achat ($)</label>
              <input type="number" value={drawerIng.prix_achat||''} onChange={e => setDrawerIng({...drawerIng,prix_achat:e.target.value})} style={inp} />
            </div>
            <div>
              <label style={{ color:'var(--muted)', fontSize:'11px', display:'block', marginBottom:'3px', textTransform:'uppercase' }}>Qté achetée (en {drawerIng.unite||'kg'})</label>
              <input type="number" value={drawerIng.qte_achetee||''} onChange={e => setDrawerIng({...drawerIng,qte_achetee:e.target.value})} style={inp} />
            </div>
          </div>
          <p style={{ color:'var(--muted)', fontSize:'12px', marginBottom:'16px' }}>
            Prix/{drawerIng.unite||'kg'} calculé : <span style={{ color:'#00E5A0', fontWeight:'700' }}>
              {drawerIng.prix_achat && drawerIng.qte_achetee ? (parseFloat(drawerIng.prix_achat)/parseFloat(drawerIng.qte_achetee)).toFixed(4) : parseFloat(drawerIng.prix_unitaire||0).toFixed(4)}$
            </span>
          </p>
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
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={drawerData.hist.map(h => ({ date: new Date(h.created_at).toLocaleDateString('fr-CA'), prix: parseFloat(h.prix) }))}>
                  <XAxis dataKey="date" tick={{ fontSize:9, fill:'#8B9BB4' }} />
                  <YAxis tick={{ fontSize:9, fill:'#8B9BB4' }} />
                  <Tooltip contentStyle={{ background:'#1a1f2e', border:'1px solid rgba(0,194,255,0.2)', borderRadius:'8px', fontSize:'11px' }} />
                  <Line type="monotone" dataKey="prix" stroke="#00C2FF" strokeWidth={2} dot={{ fill:'#00C2FF', r:3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
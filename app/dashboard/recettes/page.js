'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

export default function Recettes() {
  const [recettes, setRecettes] = useState([])
  const [orgId, setOrgId] = useState(null)
  const [fcCibleNourriture, setFcCibleNourriture] = useState(30)
  const [fcCibleBoisson, setFcCibleBoisson] = useState(15)
  const [onglet, setOnglet] = useState('dashboard')
  const [showSeuils, setShowSeuils] = useState(false)
  const [showImportMenu, setShowImportMenu] = useState(false)
  const [toast, setToast] = useState(null)
  const [search, setSearch] = useState('')
  const [categorieFiltre, setCategorieFiltre] = useState('')
  const [categorieChoisie, setCategorieChoisie] = useState('')
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
    const { data: org } = await supabase.from('organizations').select('fc_cible_nourriture, fc_cible_boisson').eq('id', member.organization_id).single()
    if (org) { setFcCibleNourriture(org.fc_cible_nourriture ?? 30); setFcCibleBoisson(org.fc_cible_boisson ?? 15) }
    await reload(member.organization_id)
  }

  async function reload(id) {
    const { data } = await supabase.from('recettes').select('*, recette_ingredients(grammage, rendement, ingredients(nom, prix_unitaire, unite, fournisseur, ingredient_base))').eq('organization_id', id || orgId).order('nom')
    setRecettes(data || [])
  }

  async function sauvegarderSeuils() {
    await supabase.from('organizations').update({ fc_cible_nourriture: parseFloat(fcCibleNourriture) || 30, fc_cible_boisson: parseFloat(fcCibleBoisson) || 15 }).eq('id', orgId)
    setShowSeuils(false)
    setToast('✓ Seuils enregistrés')
  }

  function estBoisson(r) { return (r.categorie || '').toLowerCase().includes('boisson') }
  function fcCibleDe(r) { return estBoisson(r) ? parseFloat(fcCibleBoisson) : parseFloat(fcCibleNourriture) }

  function coutReel(r) {
    return (r.recette_ingredients || []).reduce((acc, ri) => {
      const ing = ri.ingredients
      if (!ing || !ri.grammage) return acc
      const f = (ing.unite === 'g' || ing.unite === 'ml') ? ri.grammage / 1000 : ri.grammage
      const rendement = ri.rendement || 100
      return acc + ((ing.prix_unitaire || 0) * f) / (rendement / 100)
    }, 0)
  }

  function fcDe(r) {
    const c = coutReel(r)
    return r.prix_vente ? (c / r.prix_vente) * 100 : null
  }

  function margeDe(r) {
    const c = coutReel(r)
    return r.prix_vente ? r.prix_vente - c : null
  }

  function prixRecommande(r) {
    const c = coutReel(r)
    const cible = fcCibleDe(r)
    return cible ? c / (cible / 100) : null
  }

  function fcColor(v) { return v == null ? 'var(--muted)' : v <= 30 ? '#00E5A0' : v <= 38 ? '#F5A623' : '#FF4D6D' }

  const recettesAvecCalculs = useMemo(() => recettes.map(r => ({
    ...r, cout: coutReel(r), fc: fcDe(r), marge: margeDe(r), cible: fcCibleDe(r), recommande: prixRecommande(r)
  })), [recettes, fcCibleNourriture, fcCibleBoisson])

  const categories = useMemo(() => {
    const groupes = {}
    recettesAvecCalculs.forEach(r => {
      const cat = r.categorie || 'Sans catégorie'
      if (!groupes[cat]) groupes[cat] = []
      groupes[cat].push(r)
    })
    return Object.entries(groupes).sort((a,b) => b[1].length - a[1].length)
  }, [recettesAvecCalculs])

  const kpis = useMemo(() => {
    const avecPrix = recettesAvecCalculs.filter(r => r.fc != null)
    const fcMoyen = avecPrix.length ? avecPrix.reduce((a,r) => a+r.fc, 0) / avecPrix.length : null
    const margeMoyenne = avecPrix.length ? avecPrix.reduce((a,r) => a+r.marge, 0) / avecPrix.length : null
    const dansLaCible = avecPrix.filter(r => r.fc <= r.cible).length
    const score = avecPrix.length ? Math.round((dansLaCible / avecPrix.length) * 100) : null
    return { nb: recettesAvecCalculs.length, fcMoyen, margeMoyenne, score }
  }, [recettesAvecCalculs])

  const substitutions = useMemo(() => {
    const suggestions = []
    recettesAvecCalculs.forEach(r => {
      let economieTotale = 0
      const items = []
      ;(r.recette_ingredients || []).forEach(ri => {
        const ing = ri.ingredients
        if (!ing?.ingredient_base) return
        const groupe = recettesAvecCalculs.flatMap(rr => (rr.recette_ingredients||[]).map(x=>x.ingredients)).filter(i => i && i.ingredient_base === ing.ingredient_base)
        const min = Math.min(...groupe.map(i => parseFloat(i.prix_unitaire)).filter(p=>!isNaN(p)))
        if (min < parseFloat(ing.prix_unitaire)) {
          const f = (ing.unite === 'g' || ing.unite === 'ml') ? ri.grammage / 1000 : ri.grammage
          const economie = (parseFloat(ing.prix_unitaire) - min) * f
          economieTotale += economie
          items.push({ nom: ing.nom, economie })
        }
      })
      if (economieTotale > 0.01) suggestions.push({ recette: r.nom, economieTotale, items })
    })
    return suggestions.sort((a,b) => b.economieTotale - a.economieTotale)
  }, [recettesAvecCalculs])

  const recettesFiltrees = useMemo(() => recettesAvecCalculs.filter(r =>
    (!search || r.nom.toLowerCase().includes(search.toLowerCase())) &&
    (!categorieFiltre || (r.categorie || 'Sans catégorie') === categorieFiltre)
  ), [recettesAvecCalculs, search, categorieFiltre])

  async function importExcel(e) {
    const file = e.target.files[0]
    if (!file) return
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]).filter(r => r.recette && r.ingredient)
    e.target.value = ''
    if (!rows.length) return setToast('Aucune ligne valide trouvée (colonnes attendues: recette, categorie, sous_categorie, prix_vente, ingredient, quantite, rendement)')

    const { data: tousIngredients } = await supabase.from('ingredients').select('id, nom').eq('organization_id', orgId).eq('hors_inventaire', false)
    const parRecette = {}
    rows.forEach(r => { if (!parRecette[r.recette]) parRecette[r.recette] = []; parRecette[r.recette].push(r) })

    const conflits = []
    for (const [nomRecette, lignesRecette] of Object.entries(parRecette)) {
      const existante = recettes.find(r => r.nom.toLowerCase().trim() === nomRecette.toLowerCase().trim())
      const premiereLigne = lignesRecette[0]
      const lignesValides = lignesRecette.map(l => {
        const ing = tousIngredients.find(i => i.nom.toLowerCase().trim() === String(l.ingredient).toLowerCase().trim())
        return ing ? { ingredient_id: ing.id, grammage: parseFloat(l.quantite) || 0, rendement: parseFloat(l.rendement) || 100 } : null
      }).filter(Boolean)
      if (!lignesValides.length) continue
      const donnees = { nom: nomRecette, categorie: premiereLigne.categorie || '', sous_categorie: premiereLigne.sous_categorie || '', prix_vente: parseFloat(premiereLigne.prix_vente) || null }
      if (existante) conflits.push({ existante, donnees, lignes: lignesValides })
      else {
        const { data: nouvelle } = await supabase.from('recettes').insert({ ...donnees, organization_id: orgId }).select().single()
        await supabase.from('recette_ingredients').insert(lignesValides.map(l => ({ ...l, recette_id: nouvelle.id })))
      }
    }
    if (conflits.length > 0) setConflitsImport({ conflits, choix: conflits.map(() => 'remplacer') })
    else { await reload(); setToast('✓ Import terminé') }
  }

  async function confirmerConflitsRecettes() {
    const { conflits, choix } = conflitsImport
    for (let i = 0; i < conflits.length; i++) {
      const { existante, donnees, lignes } = conflits[i]
      if (choix[i] === 'remplacer') {
        await supabase.from('recettes').update(donnees).eq('id', existante.id)
        await supabase.from('recette_ingredients').delete().eq('recette_id', existante.id)
        await supabase.from('recette_ingredients').insert(lignes.map(l => ({ ...l, recette_id: existante.id })))
      } else {
        const { data: nouvelle } = await supabase.from('recettes').insert({ ...donnees, organization_id: orgId }).select().single()
        await supabase.from('recette_ingredients').insert(lignes.map(l => ({ ...l, recette_id: nouvelle.id })))
      }
    }
    setConflitsImport(null)
    await reload()
    setToast('✓ Import terminé')
  }

  async function importPhoto(e) {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    setToast('Analyse de la photo...')
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const res = await fetch('/api/recette-photo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: reader.result }) })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erreur analyse')
        router.push('/dashboard/recettes/nouvelle?depuis_photo=1')
        sessionStorage.setItem('recette_photo_extraite', JSON.stringify(data))
      } catch (err) {
        setToast('Erreur: ' + err.message)
      }
    }
    reader.readAsDataURL(file)
  }

  const inp = { width:'100%', padding:'8px 12px', borderRadius:'8px', border:'1px solid var(--border)', background:'transparent', color:'inherit', fontSize:'14px', boxSizing:'border-box' }
  const card = { background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', padding:'20px' }

  return (
    <div>
      {toast && <div style={{ position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%)', background:'#1a1f2e', border:'1px solid rgba(0,194,255,0.3)', borderRadius:'10px', padding:'12px 24px', color:'white', fontSize:'14px', zIndex:1000 }} onClick={() => setToast(null)}>{toast}</div>}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', marginBottom:'4px' }}>Recettes</h1>
          <p style={{ color:'var(--muted)', fontSize:'14px' }}>{kpis.nb} recette{kpis.nb>1?'s':''}</p>
        </div>
        <div style={{ position:'relative' }}>
          <button onClick={() => setShowImportMenu(!showImportMenu)} style={{ padding:'9px 20px', borderRadius:'8px', background:'#00C2FF', color:'#0A0F1E', fontWeight:'700', border:'none', cursor:'pointer' }}>+ Ajouter</button>
          {showImportMenu && (
            <div style={{ position:'absolute', top:'110%', right:0, background:'var(--card)', border:'1px solid var(--border)', borderRadius:'8px', overflow:'hidden', zIndex:50, minWidth:'190px', boxShadow:'0 4px 16px rgba(0,0,0,0.3)' }}>
              <button onClick={() => { setShowImportMenu(false); router.push('/dashboard/recettes/nouvelle') }} style={{ display:'block', width:'100%', textAlign:'left', padding:'10px 14px', background:'transparent', border:'none', color:'inherit', cursor:'pointer', fontSize:'13px' }} onMouseEnter={e=>e.currentTarget.style.background='var(--hover)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>✍️ Manuel</button>
              <button onClick={() => { setShowImportMenu(false); document.getElementById('recette-photo-input').click() }} style={{ display:'block', width:'100%', textAlign:'left', padding:'10px 14px', background:'transparent', border:'none', color:'inherit', cursor:'pointer', fontSize:'13px' }} onMouseEnter={e=>e.currentTarget.style.background='var(--hover)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>📸 Photo (carte recette)</button>
              <button onClick={() => { setShowImportMenu(false); document.getElementById('recette-excel-input').click() }} style={{ display:'block', width:'100%', textAlign:'left', padding:'10px 14px', background:'transparent', border:'none', color:'inherit', cursor:'pointer', fontSize:'13px' }} onMouseEnter={e=>e.currentTarget.style.background='var(--hover)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>📊 Fichier Excel</button>
            </div>
          )}
          <input id="recette-excel-input" type="file" accept=".xlsx,.xls" onChange={importExcel} style={{ display:'none' }} />
          <input id="recette-photo-input" type="file" accept="image/*,.heic,.heif" capture="environment" onChange={importPhoto} style={{ display:'none' }} />
        </div>
      </div>

      <div style={{ display:'flex', gap:'4px', marginBottom:'20px', borderBottom:'1px solid var(--border)' }}>
        {[['dashboard','📊 Dashboard'],['categorie','🗂️ Par catégorie'],['liste','📋 Liste'],['stats','📈 Statistiques']].map(([k,l]) => (
          <button key={k} onClick={() => setOnglet(k)} style={{ padding:'8px 20px', borderRadius:'8px 8px 0 0', background: onglet===k ? 'var(--card)' : 'transparent', border: onglet===k ? '1px solid var(--border)' : '1px solid transparent', borderBottom: onglet===k ? '1px solid var(--card)' : '1px solid transparent', color: onglet===k ? 'inherit' : 'var(--muted)', cursor:'pointer', fontSize:'14px', marginBottom:'-1px' }}>{l}</button>
        ))}
      </div>

      {onglet === 'dashboard' && (
        <div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'12px', position:'relative' }}>
            <button onClick={() => setShowSeuils(!showSeuils)} style={{ padding:'6px 12px', borderRadius:'8px', border:'1px solid var(--border)', background:'transparent', color:'var(--muted)', cursor:'pointer', fontSize:'12px' }}>⚙ Seuils FC cible</button>
            {showSeuils && (
              <div style={{ position:'absolute', top:'110%', right:0, zIndex:50, padding:'14px', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'8px', boxShadow:'0 4px 16px rgba(0,0,0,0.3)', minWidth:'220px' }}>
                <label style={{ fontSize:'11px', color:'var(--muted)', display:'block', marginBottom:'4px' }}>Nourriture (%)</label>
                <input type="number" value={fcCibleNourriture} onChange={e => setFcCibleNourriture(e.target.value)} style={{ ...inp, marginBottom:'10px' }} />
                <label style={{ fontSize:'11px', color:'var(--muted)', display:'block', marginBottom:'4px' }}>Boisson (%)</label>
                <input type="number" value={fcCibleBoisson} onChange={e => setFcCibleBoisson(e.target.value)} style={{ ...inp, marginBottom:'10px' }} />
                <button onClick={sauvegarderSeuils} style={{ width:'100%', padding:'8px', borderRadius:'8px', background:'#00C2FF', color:'#0A0F1E', fontWeight:'700', border:'none', cursor:'pointer', fontSize:'13px' }}>Enregistrer</button>
              </div>
            )}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'24px' }}>
            <div style={card}><p style={{ fontSize:'12px', color:'var(--muted)', marginBottom:'6px' }}>Recettes actives</p><p style={{ fontSize:'24px', fontWeight:'700' }}>{kpis.nb}</p></div>
            <div style={card}><p style={{ fontSize:'12px', color:'var(--muted)', marginBottom:'6px' }}>Food cost moyen</p><p style={{ fontSize:'24px', fontWeight:'700', color:fcColor(kpis.fcMoyen) }}>{kpis.fcMoyen!=null?kpis.fcMoyen.toFixed(1)+'%':'—'}</p></div>
            <div style={card}><p style={{ fontSize:'12px', color:'var(--muted)', marginBottom:'6px' }}>Marge moyenne</p><p style={{ fontSize:'24px', fontWeight:'700' }}>{kpis.margeMoyenne!=null?kpis.margeMoyenne.toFixed(2)+'$':'—'}</p></div>
            <div style={card}><p style={{ fontSize:'12px', color:'var(--muted)', marginBottom:'6px' }}>Score santé menu</p><p style={{ fontSize:'24px', fontWeight:'700', color: kpis.score==null?'var(--muted)':kpis.score>=80?'#00E5A0':kpis.score>=60?'#F5A623':'#FF4D6D' }}>{kpis.score!=null?kpis.score+'/100':'—'}</p></div>
          </div>

          <p style={{ color:'var(--muted)', fontSize:'12px', marginBottom:'12px', textTransform:'uppercase', letterSpacing:'1px' }}>Recettes par catégorie</p>
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
            {categories.map(([cat, items]) => (
              <button key={cat} onClick={() => { setCategorieChoisie(cat); setOnglet('categorie') }} style={{ padding:'8px 14px', borderRadius:'8px', border:'1px solid var(--border)', background:'var(--card)', color:'inherit', cursor:'pointer', fontSize:'13px' }}>{cat} <span style={{ color:'var(--muted)' }}>({items.length})</span></button>
            ))}
            {categories.length === 0 && <p style={{ color:'var(--muted)', fontSize:'13px' }}>Aucune recette encore</p>}
          </div>
        </div>
      )}

      {onglet === 'categorie' && (
        <div>
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'20px' }}>
            {categories.map(([cat, items]) => (
              <button key={cat} onClick={() => setCategorieChoisie(cat)} style={{ padding:'7px 14px', borderRadius:'8px', border:'1px solid '+(categorieChoisie===cat?'#00C2FF':'var(--border)'), background: categorieChoisie===cat?'rgba(0,194,255,0.1)':'transparent', color: categorieChoisie===cat?'#00C2FF':'var(--muted)', cursor:'pointer', fontSize:'13px' }}>{cat} ({items.length})</button>
            ))}
          </div>
          {!categorieChoisie ? <p style={{ color:'var(--muted)', fontSize:'13px' }}>Choisis une catégorie ci-dessus</p> : (
            <div style={{ ...card, padding:0, overflow:'hidden' }}>
              {(categories.find(([c]) => c === categorieChoisie)?.[1] || []).map(r => (
                <div key={r.id} onClick={() => router.push(`/dashboard/recettes/${r.id}`)} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', padding:'14px 20px', borderBottom:'1px solid var(--border)', cursor:'pointer', alignItems:'center' }} onMouseEnter={e=>e.currentTarget.style.background='var(--hover)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <div><div style={{ fontWeight:'500' }}>{r.nom}</div><div style={{ color:'var(--muted)', fontSize:'12px' }}>{r.sous_categorie || '—'}</div></div>
                  <span style={{ color:'#00C2FF' }}>{r.cout.toFixed(2)}$</span>
                  <span>{r.prix_vente ? r.prix_vente+'$' : '—'}</span>
                  <span style={{ color: fcColor(r.fc) }}>{r.fc!=null ? r.fc.toFixed(1)+'%' : '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {onglet === 'liste' && (
        <div>
          <div style={{ display:'flex', gap:'10px', marginBottom:'16px' }}>
            <input placeholder="Rechercher une recette" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex:1 }} />
            <select value={categorieFiltre} onChange={e => setCategorieFiltre(e.target.value)} style={{ ...inp, width:'200px' }}>
              <option value=''>Toutes catégories</option>
              {categories.map(([c]) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ ...card, padding:0, overflow:'hidden' }}>
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', padding:'10px 20px', borderBottom:'1px solid var(--border)' }}>
              {['Nom','Coût réel','Prix vente','Food cost'].map((h,i) => <span key={i} style={{ color:'var(--muted)', fontSize:'12px', textTransform:'uppercase', letterSpacing:'1px' }}>{h}</span>)}
            </div>
            {recettesFiltrees.length === 0 && <p style={{ color:'var(--muted)', textAlign:'center', padding:'40px' }}>Aucune recette</p>}
            {recettesFiltrees.map(r => (
              <div key={r.id} onClick={() => router.push(`/dashboard/recettes/${r.id}`)} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', padding:'14px 20px', borderBottom:'1px solid var(--border)', cursor:'pointer', alignItems:'center' }} onMouseEnter={e=>e.currentTarget.style.background='var(--hover)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <div><div style={{ fontWeight:'500' }}>{r.nom}</div><div style={{ color:'var(--muted)', fontSize:'12px' }}>{r.categorie || 'Sans catégorie'}{r.sous_categorie?' · '+r.sous_categorie:''} · {r.recette_ingredients?.length||0} ingrédients</div></div>
                <span style={{ color:'#00C2FF' }}>{r.cout.toFixed(2)}$</span>
                <span>{r.prix_vente ? r.prix_vente+'$' : '—'}</span>
                <span style={{ color: fcColor(r.fc) }}>{r.fc!=null ? r.fc.toFixed(1)+'%' : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {onglet === 'stats' && (
        <div>
          <p style={{ color:'var(--muted)', fontSize:'12px', marginBottom:'12px', textTransform:'uppercase', letterSpacing:'1px' }}>Analyse par recette</p>
          {recettesAvecCalculs.filter(r => r.prix_vente).map(r => {
            const risque = r.fc > r.cible
            return (
              <div key={r.id} style={{ ...card, marginBottom:'14px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
                  <span onClick={() => router.push(`/dashboard/recettes/${r.id}`)} style={{ fontWeight:'600', cursor:'pointer' }}>{r.nom}</span>
                  {risque ? <span style={{ background:'rgba(255,77,109,0.15)', color:'#FF4D6D', padding:'3px 10px', borderRadius:'6px', fontSize:'12px' }}>Marge à risque</span> : <span style={{ background:'rgba(0,229,160,0.15)', color:'#00E5A0', padding:'3px 10px', borderRadius:'6px', fontSize:'12px' }}>Stable</span>}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom: risque ? '10px' : 0 }}>
                  <div><p style={{ fontSize:'11px', color:'var(--muted)', margin:0 }}>Coût réel</p><p style={{ fontSize:'15px', fontWeight:'600', margin:0 }}>{r.cout.toFixed(2)}$</p></div>
                  <div><p style={{ fontSize:'11px', color:'var(--muted)', margin:0 }}>Prix vente</p><p style={{ fontSize:'15px', fontWeight:'600', margin:0 }}>{r.prix_vente}$</p></div>
                  <div><p style={{ fontSize:'11px', color:'var(--muted)', margin:0 }}>Food cost</p><p style={{ fontSize:'15px', fontWeight:'600', margin:0, color:fcColor(r.fc) }}>{r.fc.toFixed(1)}% <span style={{ fontSize:'11px', color:'var(--muted)' }}>(cible {r.cible}%)</span></p></div>
                  <div><p style={{ fontSize:'11px', color:'var(--muted)', margin:0 }}>Marge</p><p style={{ fontSize:'15px', fontWeight:'600', margin:0 }}>{r.marge.toFixed(2)}$</p></div>
                </div>
                {risque && <p style={{ fontSize:'12px', color:'var(--muted)', margin:0 }}>Prix recommandé (FC cible {r.cible}%) : <span style={{ color:'inherit', fontWeight:'600' }}>{r.recommande.toFixed(2)}$</span></p>}
              </div>
            )
          })}
          {recettesAvecCalculs.filter(r => r.prix_vente).length === 0 && <p style={{ color:'var(--muted)', fontSize:'13px' }}>Ajoute un prix de vente à tes recettes pour voir l'analyse</p>}

          <p style={{ color:'var(--muted)', fontSize:'12px', margin:'28px 0 12px', textTransform:'uppercase', letterSpacing:'1px' }}>Résumé par catégorie</p>
          <div style={{ ...card, padding:0, overflow:'hidden', marginBottom:'24px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', padding:'10px 20px', borderBottom:'1px solid var(--border)' }}>
              {['Catégorie','FC moyen','Marge moyenne'].map((h,i) => <span key={i} style={{ color:'var(--muted)', fontSize:'12px', textTransform:'uppercase' }}>{h}</span>)}
            </div>
            {categories.map(([cat, items]) => {
              const avecPrix = items.filter(r => r.prix_vente)
              const fcMoy = avecPrix.length ? avecPrix.reduce((a,r)=>a+r.fc,0)/avecPrix.length : null
              const margeMoy = avecPrix.length ? avecPrix.reduce((a,r)=>a+r.marge,0)/avecPrix.length : null
              return (
                <div key={cat} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', padding:'12px 20px', borderBottom:'1px solid var(--border)' }}>
                  <span>{cat}</span>
                  <span style={{ color: fcColor(fcMoy) }}>{fcMoy!=null?fcMoy.toFixed(1)+'%':'—'}</span>
                  <span>{margeMoy!=null?margeMoy.toFixed(2)+'$':'—'}</span>
                </div>
              )
            })}
          </div>

          <p style={{ color:'var(--muted)', fontSize:'12px', margin:'0 0 12px', textTransform:'uppercase', letterSpacing:'1px' }}>Suggestions de substitution</p>
          {substitutions.length === 0 ? (
            <div style={{ ...card, textAlign:'center' }}><p style={{ color:'var(--muted)', fontSize:'13px' }}>Aucune économie détectée sur tes ingrédients liés</p></div>
          ) : substitutions.map((s,i) => (
            <div key={i} style={{ ...card, marginBottom:'10px' }}>
              <p style={{ margin:'0 0 6px' }}><span style={{ fontWeight:'600' }}>{s.recette}</span> <span style={{ color:'#F5A623', fontSize:'13px' }}>— économie potentielle {s.economieTotale.toFixed(2)}$</span></p>
              {s.items.map((it,j) => <p key={j} style={{ fontSize:'12px', color:'var(--muted)', margin:'2px 0' }}>{it.nom} : {it.economie.toFixed(2)}$</p>)}
            </div>
          ))}
        </div>
      )}

      {conflitsImport && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', padding:'24px', maxWidth:'600px', width:'90%', maxHeight:'80vh', overflowY:'auto' }}>
            <p style={{ fontWeight:'700', marginBottom:'16px' }}>{conflitsImport.conflits.length} recette(s) déjà existante(s)</p>
            {conflitsImport.conflits.map((c, i) => (
              <div key={i} style={{ marginBottom:'14px', paddingBottom:'14px', borderBottom:'1px solid var(--border)' }}>
                <p style={{ fontSize:'14px', marginBottom:'8px' }}>{c.existante.nom}</p>
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={() => setConflitsImport(prev => ({ ...prev, choix: prev.choix.map((v,j) => j===i ? 'remplacer' : v) }))} style={{ padding:'6px 12px', borderRadius:'6px', border:'1px solid '+(conflitsImport.choix[i]==='remplacer'?'#00C2FF':'var(--border)'), background: conflitsImport.choix[i]==='remplacer'?'rgba(0,194,255,0.15)':'transparent', color:'inherit', cursor:'pointer', fontSize:'12px' }}>Remplacer</button>
                  <button onClick={() => setConflitsImport(prev => ({ ...prev, choix: prev.choix.map((v,j) => j===i ? 'nouveau' : v) }))} style={{ padding:'6px 12px', borderRadius:'6px', border:'1px solid '+(conflitsImport.choix[i]==='nouveau'?'#00C2FF':'var(--border)'), background: conflitsImport.choix[i]==='nouveau'?'rgba(0,194,255,0.15)':'transparent', color:'inherit', cursor:'pointer', fontSize:'12px' }}>Créer séparément</button>
                </div>
              </div>
            ))}
            <div style={{ display:'flex', gap:'10px', marginTop:'16px' }}>
              <button onClick={confirmerConflitsRecettes} style={{ flex:1, padding:'10px', borderRadius:'8px', background:'#00C2FF', color:'#0A0F1E', fontWeight:'700', border:'none', cursor:'pointer' }}>Confirmer l'import</button>
              <button onClick={() => setConflitsImport(null)} style={{ flex:1, padding:'10px', borderRadius:'8px', background:'transparent', border:'1px solid var(--border)', color:'inherit', cursor:'pointer' }}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

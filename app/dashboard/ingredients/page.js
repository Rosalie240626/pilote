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
  const [recetteIngredients, setRecetteIngredients] = useState([])
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
    const { data: ri } = await supabase.from('recette_ingredients').select('ingredient_id, grammage')
    setRecetteIngredients(ri || [])
  }

  async function reload() {
    const { data } = await supabase.from('ingredients').select('*').eq('organization_id', orgId).eq('archived', false).order('nom')
    setIngredients((data || []).filter(Boolean))
  }

  const ingredientsActifs = useMemo(() => ingredients.filter(Boolean).filter(i => !i.hors_inventaire), [ingredients])

  const ingredientsUtilisesRecettes = useMemo(() => new Set(recetteIngredients.map(r => r.ingredient_id)), [recetteIngredients])

  const filtered = useMemo(() => {
    let list = ingredientsActifs
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
      const items = ingredients.filter(i => i && (i.ingredient_base || i.nom) === groupe)
      row.categorie = items[0]?.categorie || ''
      items.forEach(i => { if (i.fournisseur) { row[i.fournisseur] = parseFloat(i.prix_unitaire); row[i.fournisseur+'_format'] = i.format_achat } })
      return row
    }).filter(r => fournisseurs.some(f => r[f] != null))
  }, [ingredients, fournisseurs])

  const historiqueFiltre = useMemo(() => {
    if (!ingFournisseur) return []
    return historique.filter(h => h.ingredients?.nom === ingFournisseur).map(h => ({
      date: new Date(h.created_at).toLocaleDateString('fr-CA'),
      prix: parseFloat(h.prix)
    }))
  }, [historique, ingFournisseur])

  const [analyseMode, setAnalyseMode] = useState('produit')
  const [groupeSelectionne, setGroupeSelectionne] = useState('')
  const [fournisseurSelectionne, setFournisseurSelectionne] = useState('')
  const [indiceExterne, setIndiceExterne] = useState(null)

  const groupesDisponibles = useMemo(() => [...new Set(ingredients.map(i => i?.ingredient_base || i?.nom).filter(Boolean))].sort(), [ingredients])

  function calculerForecast(rows) {
    if (rows.length < 2) return null
    const sorted = [...rows].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    const premier = sorted[0], dernier = sorted[sorted.length - 1]
    const jours = (new Date(dernier.created_at) - new Date(premier.created_at)) / 86400000
    if (jours < 14 || !parseFloat(premier.prix)) return null
    const tauxAnnuel = Math.pow(parseFloat(dernier.prix) / parseFloat(premier.prix), 365 / jours) - 1
    return { tauxAnnuel, prixActuel: parseFloat(dernier.prix), prixEstime: parseFloat(dernier.prix) * (1 + tauxAnnuel), jours: Math.round(jours) }
  }

  const comparaisonGroupeData = useMemo(() => {
    if (!groupeSelectionne) return { chart: [], fournisseursGroupe: [], forecast: null }
    const idsGroupe = ingredients.filter(i => (i.ingredient_base || i.nom) === groupeSelectionne).map(i => i.id)
    const rows = historique.filter(h => idsGroupe.includes(h.ingredient_id))
    const fournisseursGroupe = [...new Set(rows.map(h => h.fournisseur || h.ingredients?.fournisseur || 'Inconnu'))]
    const dates = [...new Set(rows.map(h => new Date(h.created_at).toLocaleDateString('fr-CA')))].sort((a,b) => new Date(a)-new Date(b))
    const chart = dates.map(date => {
      const point = { date }
      rows.filter(h => new Date(h.created_at).toLocaleDateString('fr-CA') === date).forEach(h => { point[h.fournisseur || h.ingredients?.fournisseur || 'Inconnu'] = parseFloat(h.prix) })
      return point
    })
    return { chart, fournisseursGroupe, forecast: calculerForecast(rows) }
  }, [historique, ingredients, groupeSelectionne])

  const produitsDuFournisseur = useMemo(() => {
    if (!fournisseurSelectionne) return []
    const ings = ingredients.filter(i => i.fournisseur === fournisseurSelectionne)
    return ings.map(ing => {
      const rows = historique.filter(h => h.ingredient_id === ing.id)
      const groupe = ing.ingredient_base ? ingredients.filter(i => i.ingredient_base === ing.ingredient_base) : []
      const moinsCher = groupe.reduce((min, i) => parseFloat(i.prix_unitaire) < parseFloat(min.prix_unitaire) ? i : min, ing)
      return { ing, forecast: calculerForecast(rows), alternative: moinsCher.id !== ing.id ? moinsCher : null }
    })
  }, [historique, ingredients, fournisseurSelectionne])

  useEffect(() => {
    if (!groupeSelectionne) { setIndiceExterne(null); return }
    const ing = ingredients.find(i => (i.ingredient_base || i.nom) === groupeSelectionne)
    if (!ing?.categorie) { setIndiceExterne(null); return }
    fetch('/api/indices?categorie=' + encodeURIComponent(ing.categorie))
      .then(r => r.json())
      .then(d => setIndiceExterne(d.error ? null : d))
      .catch(() => setIndiceExterne(null))
  }, [groupeSelectionne, ingredients])

  const [searchFiche, setSearchFiche] = useState('')
  const [categorieFiche, setCategorieFiche] = useState('')
  const [searchComparatif, setSearchComparatif] = useState('')
  const [categorieComparatif, setCategorieComparatif] = useState('')

  const groupesAvecCategorie = useMemo(() => groupesDisponibles.map(g => {
    const ing = ingredients.find(i => (i.ingredient_base || i.nom) === g)
    return { nom: g, categorie: ing?.categorie || '' }
  }), [groupesDisponibles, ingredients])

  const produitsListe = useMemo(() => groupesAvecCategorie.filter(g =>
    (!searchFiche || g.nom.toLowerCase().includes(searchFiche.toLowerCase())) &&
    (!categorieFiche || g.categorie === categorieFiche)
  ), [groupesAvecCategorie, searchFiche, categorieFiche])

  const fournisseursListe = useMemo(() => fournisseurs.filter(f => !searchFiche || f.toLowerCase().includes(searchFiche.toLowerCase())), [fournisseurs, searchFiche])

  const statsGroupe = useMemo(() => {
    if (!groupeSelectionne) return null
    const items = ingredients.filter(i => (i.ingredient_base || i.nom) === groupeSelectionne)
    const prix = items.map(i => parseFloat(i.prix_unitaire)).filter(p => !isNaN(p))
    const classement = [...items].sort((a,b) => parseFloat(a.prix_unitaire) - parseFloat(b.prix_unitaire))
    const idsGroupe = items.map(i => i.id)
    const rowsHist = historique.filter(h => idsGroupe.includes(h.ingredient_id))
    const dernierAchat = rowsHist.length ? rowsHist.reduce((max, h) => new Date(h.created_at) > new Date(max) ? h.created_at : max, rowsHist[0].created_at) : null
    return {
      nbFournisseurs: new Set(items.map(i => i.fournisseur).filter(Boolean)).size,
      meilleurPrix: prix.length ? Math.min(...prix) : null,
      prixMoyen: prix.length ? prix.reduce((a,b) => a+b, 0) / prix.length : null,
      unite: items[0]?.unite || '',
      classement,
      dernierAchat
    }
  }, [ingredients, historique, groupeSelectionne])

  const [detailIngredientId, setDetailIngredientId] = useState(null)

  useEffect(() => { setDetailIngredientId(null) }, [groupeSelectionne])

  const detailHistorique = useMemo(() => {
    if (!detailIngredientId) return []
    return historique.filter(h => h.ingredient_id === detailIngredientId).sort((a,b) => new Date(a.created_at) - new Date(b.created_at))
  }, [historique, detailIngredientId])

  const economiePotentielle = useMemo(() => {
    if (!groupeSelectionne || !statsGroupe?.meilleurPrix) return null
    const idsGroupe = ingredients.filter(i => (i.ingredient_base || i.nom) === groupeSelectionne).map(i => i.id)
    let total = 0
    recetteIngredients.forEach(ri => {
      if (!idsGroupe.includes(ri.ingredient_id)) return
      const ing = ingredients.find(i => i.id === ri.ingredient_id)
      if (!ing || !ri.grammage) return
      const facteur = (ing.unite === 'g' || ing.unite === 'ml') ? ri.grammage / 1000 : parseFloat(ri.grammage)
      total += facteur * (parseFloat(ing.prix_unitaire) - statsGroupe.meilleurPrix)
    })
    return total > 0.01 ? total : null
  }, [ingredients, recetteIngredients, groupeSelectionne, statsGroupe])

  const statsFournisseur = useMemo(() => {
    if (!fournisseurSelectionne) return null
    const total = produitsDuFournisseur.reduce((acc, { ing }) => acc + (parseFloat(ing.prix_achat) || 0), 0)
    return { nbProduits: produitsDuFournisseur.length, totalDernieresCommandes: total }
  }, [fournisseurSelectionne, produitsDuFournisseur])

  function exporterFiche() {
    let texte = ''
    if (analyseMode === 'produit' && groupeSelectionne && statsGroupe) {
      texte = `${groupeSelectionne}\n\nFournisseurs: ${statsGroupe.nbFournisseurs}\nMeilleur prix: ${statsGroupe.meilleurPrix?.toFixed(2)}$/${statsGroupe.unite}\nPrix moyen: ${statsGroupe.prixMoyen?.toFixed(2)}$/${statsGroupe.unite}\n\nClassement:\n` + statsGroupe.classement.map(i => `- ${i.fournisseur||'?'}: ${parseFloat(i.prix_unitaire).toFixed(2)}$/${i.unite}`).join('\n')
    } else if (analyseMode === 'fournisseur' && fournisseurSelectionne && statsFournisseur) {
      texte = `${fournisseurSelectionne}\n\nProduits: ${statsFournisseur.nbProduits}\n\n` + produitsDuFournisseur.map(({ing}) => `- ${ing.nom}: ${parseFloat(ing.prix_unitaire).toFixed(2)}$/${ing.unite}`).join('\n')
    } else return
    const a = document.createElement('a')
    a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(texte)
    a.download = (groupeSelectionne || fournisseurSelectionne) + '.txt'
    a.click()
  }

  function groupKeyDe(ing) { return ing.ingredient_base || null }

  const [sousOngletFournisseur, setSousOngletFournisseur] = useState('historique')
  const [rechercheStatsF, setRechercheStatsF] = useState('')
  const [categorieStatsF, setCategorieStatsF] = useState('')
  const [seuilAlerte, setSeuilAlerte] = useState(10)
  const [showSeuil, setShowSeuil] = useState(false)
  const [modeDuel, setModeDuel] = useState(false)
  const [duelA, setDuelA] = useState('')
  const [duelB, setDuelB] = useState('')

  const statsFournisseursTous = useMemo(() => {
    return fournisseurs.map(f => {
      const items = ingredients.filter(i => i.fournisseur === f)
      const itemsGroupes = items.filter(i => i.ingredient_base)
      let gagnes = 0
      itemsGroupes.forEach(ing => {
        const groupe = ingredients.filter(i => i.ingredient_base === ing.ingredient_base)
        const prixGroupe = groupe.map(i => parseFloat(i.prix_unitaire)).filter(p => !isNaN(p))
        const min = prixGroupe.length ? Math.min(...prixGroupe) : null
        if (min !== null && parseFloat(ing.prix_unitaire) === min) gagnes++
      })
      const idsF = items.map(i => i.id)
      const tendances = items.map(ing => calculerForecast(historique.filter(h => h.ingredient_id === ing.id))).filter(Boolean).map(fc => fc.tauxAnnuel)
      const tendanceMoyenne = tendances.length ? tendances.reduce((a,b) => a+b, 0) / tendances.length : null
      const depenses = items.reduce((acc,i) => acc + (parseFloat(i.prix_achat) || 0), 0)
      const nbCommandes = historique.filter(h => idsF.includes(h.ingredient_id)).length
      return { fournisseur: f, nbProduits: items.length, competitivite: itemsGroupes.length ? Math.round(gagnes/itemsGroupes.length*100) : null, tendanceMoyenne, depenses, nbCommandes }
    })
  }, [fournisseurs, ingredients, historique])

  const statsFournisseursFiltres = useMemo(() => statsFournisseursTous.filter(s =>
    (!rechercheStatsF || s.fournisseur.toLowerCase().includes(rechercheStatsF.toLowerCase())) &&
    (!categorieStatsF || ingredients.some(i => i.fournisseur === s.fournisseur && i.categorie === categorieStatsF))
  ).sort((a,b) => a.fournisseur.localeCompare(b.fournisseur)), [statsFournisseursTous, rechercheStatsF, categorieStatsF, ingredients])

  function statutFournisseur(tendanceMoyenne) {
    if (tendanceMoyenne == null) return { label:'—', bg:'rgba(255,255,255,0.05)', color:'var(--muted)' }
    const pct = tendanceMoyenne*100
    if (pct >= seuilAlerte) return { label:'alerte', bg:'rgba(255,77,109,0.15)', color:'#FF4D6D' }
    if (pct >= seuilAlerte/2) return { label:'à surveiller', bg:'rgba(245,166,35,0.15)', color:'#F5A623' }
    return { label:'stable', bg:'rgba(0,229,160,0.15)', color:'#00E5A0' }
  }

  const duelData = useMemo(() => {
    if (!duelA || !duelB) return null
    const itemsA = ingredients.filter(i => i.fournisseur === duelA && i.ingredient_base)
    const itemsB = ingredients.filter(i => i.fournisseur === duelB && i.ingredient_base)
    const communs = itemsA.filter(ia => itemsB.some(ib => ib.ingredient_base === ia.ingredient_base)).map(ia => {
      const ib = itemsB.find(ib => ib.ingredient_base === ia.ingredient_base)
      return { nom: ia.ingredient_base, ingA: ia, ingB: ib }
    })
    return communs
  }, [ingredients, duelA, duelB])

  const comparaisonFiltree = useMemo(() => comparaisonData.filter(r =>
    (!searchComparatif || r.nom.toLowerCase().includes(searchComparatif.toLowerCase())) &&
    (!categorieComparatif || r.categorie === categorieComparatif)
  ), [comparaisonData, searchComparatif, categorieComparatif])

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
    d.qte_achetee = parseFloat(d.qte_achetee) || null
    d.prix_achat = parseFloat(d.prix_achat) || null
    if (d.prix_achat && d.qte_achetee) d.prix_unitaire = d.prix_achat / d.qte_achetee
    const ancien = ingredients.find(i => i.id === d.id)
    if (ancien && parseFloat(ancien.prix_unitaire) !== parseFloat(d.prix_unitaire)) {
      const { error: errHist } = await supabase.from('ingredients_prix_historique').insert({ ingredient_id: d.id, prix: d.prix_unitaire, fournisseur: d.fournisseur, prix_achat: d.prix_achat, qte_achetee: d.qte_achetee, format_achat: d.format_achat || null, unite: d.unite })
      if (errHist) return setToast('Erreur historique: ' + errHist.message)
    }
    const { error } = await supabase.from('ingredients').update(d).eq('id', d.id)
    if (error) return setToast('Erreur sauvegarde: ' + error.message)
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

  async function regrouperSelection() {
    const nom = window.prompt(`Nom du groupe pour les ${selected.length} ingrédients sélectionnés :`, '')
    if (!nom) return
    await supabase.from('ingredients').update({ ingredient_base: nom }).in('id', selected)
    await reload()
    setSelected([])
    setToast(`✓ ${selected.length} ingrédients regroupés sous "${nom}"`)
  }

  async function dupliquer(ing) {
    const { id, created_at, ...rest } = ing
    const { data } = await supabase.from('ingredients').insert({...rest, nom: ing.nom+' (copie)'}).select().single()
    setIngredients(prev => [...prev, data].filter(Boolean))
    setToast('Dupliqué')
  }

  function champsDe(r) {
    return {
      marque: r.marque ? String(r.marque) : null,
      code_produit: r.code_produit ? String(r.code_produit) : null,
      categorie: r.categorie || null,
      fournisseur: r.fournisseur || null,
      unite: r.unite || 'unité',
      format_achat: r.format_achat ? String(r.format_achat) : null,
      prix_unitaire: parseFloat(r.prix_unitaire) || 0,
      prix_achat: parseFloat(r.prix_achat) || null,
      qte_achetee: parseFloat(r.qte_achetee) || null,
      notes: r.notes ? String(r.notes) : null,
    }
  }

  async function appliquerLignes(lignes) {
    for (const { row: r, existant } of lignes) {
      const champs = champsDe(r)
      let id = existant?.id
      if (existant) await supabase.from('ingredients').update(champs).eq('id', existant.id)
      else { const { data } = await supabase.from('ingredients').insert({ ...champs, nom: String(r.nom), organization_id: orgId, archived: false }).select().single(); id = data?.id }
      if (id) await supabase.from('ingredients_prix_historique').insert({ ingredient_id: id, prix: champs.prix_unitaire, fournisseur: champs.fournisseur, prix_achat: champs.prix_achat, qte_achetee: champs.qte_achetee, format_achat: champs.format_achat, unite: champs.unite })
    }
  }

  async function traiterImport(rows) {
    const conflits = [], aTraiter = []
    for (const r of rows) {
      const nomNorm = String(r.nom).toLowerCase().trim()
      const existant = ingredients.find(i => i.nom.toLowerCase().trim() === nomNorm && (i.fournisseur||'') === (r.fournisseur||''))
      const nouveauPrix = parseFloat(r.prix_unitaire) || 0
      if (existant && parseFloat(existant.prix_unitaire) !== nouveauPrix) conflits.push({ row: r, existant })
      else aTraiter.push({ row: r, existant })
    }
    await appliquerLignes(aTraiter)
    if (conflits.length > 0) setConflitsImport({ conflits, choix: conflits.map(() => 'remplacer') })
    else { await reload(); setToast('✓ Import terminé') }
  }

  async function confirmerConflits() {
    const { conflits, choix } = conflitsImport
    for (let i = 0; i < conflits.length; i++) {
      const { row: r, existant } = conflits[i]
      const champs = champsDe(r)
      let id
      if (choix[i] === 'remplacer') {
        id = existant.id
        await supabase.from('ingredients').update(champs).eq('id', id)
      } else {
        const { data } = await supabase.from('ingredients').insert({ ...champs, nom: String(r.nom), organization_id: orgId, archived: false }).select().single()
        id = data?.id
      }
      if (id) await supabase.from('ingredients_prix_historique').insert({ ingredient_id: id, prix: champs.prix_unitaire, fournisseur: champs.fournisseur, prix_achat: champs.prix_achat, qte_achetee: champs.qte_achetee, format_achat: champs.format_achat, unite: champs.unite })
    }
    setConflitsImport(null)
    await reload()
    setToast('✓ Import terminé')
  }

  async function importExcel(e) {
    const file = e.target.files[0]
    if (!file) return
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]).filter(r => r.nom)
    e.target.value = ''
    await traiterImport(rows)
  }

  async function importCatalogue(e) {
    const file = e.target.files[0]
    if (!file) return
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]).filter(r => r.nom)
    e.target.value = ''
    const toInsert = rows.map(r => ({ ...champsDe(r), nom: String(r.nom), organization_id: orgId, archived: false, hors_inventaire: true }))
    if (!toInsert.length) return setToast('Aucune ligne valide trouvée')
    const { error } = await supabase.from('ingredients').insert(toInsert)
    if (error) return setToast('Erreur import: ' + error.message)
    await reload()
    setToast(`✓ ${toInsert.length} prix ajoutés au catalogue (hors inventaire)`)
  }

  function exportExcel() {
    const rows = filtered.map(i => ({
      Nom: i.nom, Marque: i.marque||'', Code: i.code_produit||'', Catégorie: i.categorie||'',
      Fournisseur: i.fournisseur||'', Unité: i.unite, 'Format achat': i.format_achat||'',
      'Prix/unité': parseFloat(i.prix_unitaire), Détail: petitPrix(i)
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{wch:28},{wch:14},{wch:12},{wch:14},{wch:22},{wch:8},{wch:20},{wch:12},{wch:14}]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Ingrédients')
    XLSX.writeFile(wb, 'ingredients.xlsx')
    setToast('Export téléchargé')
  }

  function petitPrix(ing) {
    const p = parseFloat(ing.prix_unitaire)
    if (!p) return '—'
    if (ing.unite === 'kg') return (p/10).toFixed(3)+'$/100g'
    if (ing.unite === 'L') return (p/10).toFixed(3)+'$/100ml'
    return '—'
  }

  const [doublonsIgnores, setDoublonsIgnores] = useState([])

  useEffect(() => {
    try { setDoublonsIgnores(JSON.parse(localStorage.getItem('doublons_ignores') || '[]')) } catch { setDoublonsIgnores([]) }
  }, [])

  const doublonsDetectes = useMemo(() => {
    const groups = {}
    ingredientsActifs.forEach(i => {
      if (!i) return
      const key = i.nom.toLowerCase().trim().replace(/\s+/g, ' ')
      if (!groups[key]) groups[key] = []
      groups[key].push(i)
    })
    return Object.values(groups).filter(g => g.length > 1 && !doublonsIgnores.includes(g[0].nom.toLowerCase().trim()))
  }, [ingredients, doublonsIgnores])

  const [fusionChoix, setFusionChoix] = useState({})
  const [fusionInclus, setFusionInclus] = useState({})
  const [showImportMenu, setShowImportMenu] = useState(false)
  const [conflitsImport, setConflitsImport] = useState(null)

  const [lienChoisi, setLienChoisi] = useState('')
  const [nouveauLien, setNouveauLien] = useState('')

  const ingredientsHorsLien = useMemo(() => {
    if (!lienChoisi) return []
    return ingredientsActifs.filter(i => i.ingredient_base !== lienChoisi).sort((a,b) => a.nom.localeCompare(b.nom))
  }, [ingredientsActifs, lienChoisi])

  const [selectionLien, setSelectionLien] = useState([])

  async function retirerDuLien(ing) {
    await supabase.from('ingredients').update({ ingredient_base: null }).eq('id', ing.id)
    await reload()
    setToast('✓ Retiré du lien')
  }

  const liensExistantsDetail = useMemo(() => {
    const groupes = {}
    ingredientsActifs.forEach(i => {
      if (!i.ingredient_base) return
      if (!groupes[i.ingredient_base]) groupes[i.ingredient_base] = []
      groupes[i.ingredient_base].push(i)
    })
    return Object.entries(groupes).sort((a,b) => a[0].localeCompare(b[0]))
  }, [ingredientsActifs])

  async function ajouterAuLien() {
    if (!lienChoisi || !selectionLien.length) return
    await supabase.from('ingredients').update({ ingredient_base: lienChoisi }).in('id', selectionLien)
    await reload()
    setSelectionLien([])
    setToast(`✓ ${selectionLien.length} ingrédients ajoutés au lien "${lienChoisi}"`)
  }

  const suggestionsLiens = useMemo(() => {
    const mots = {}
    ingredientsActifs.forEach(ing => {
      const tokens = new Set(ing.nom.toLowerCase().split(/[^a-zàâäéèêëîïôöùûüç]+/).filter(t => t.length >= 4))
      tokens.forEach(t => { if (!mots[t]) mots[t] = []; mots[t].push(ing) })
    })
    return Object.entries(mots)
      .filter(([mot, items]) => items.length > 1 && new Set(items.map(i => i.ingredient_base || i.id)).size > 1)
      .map(([mot, items]) => ({ mot, items }))
      .sort((a,b) => b.items.length - a.items.length)
      .slice(0, 15)
  }, [ingredientsActifs])

  const [selectionSuggestion, setSelectionSuggestion] = useState({})

  const [nomsSuggestion, setNomsSuggestion] = useState({})

  async function lierSuggestion(mot, items) {
    const ids = selectionSuggestion[mot] || items.map(i => i.id)
    if (ids.length < 2) return setToast('Sélectionne au moins 2 ingrédients')
    const nom = (nomsSuggestion[mot] || mot).trim()
    if (!nom) return setToast('Donne un nom au lien')
    await supabase.from('ingredients').update({ ingredient_base: nom }).in('id', ids)
    await reload()
    setToast(`✓ Liés sous "${nom}"`)
  }

  const [rechercheLien, setRechercheLien] = useState('')
  const [selectionRecherche, setSelectionRecherche] = useState([])
  const [nomLienRecherche, setNomLienRecherche] = useState('')

  const resultatsRechercheLien = useMemo(() => {
    if (rechercheLien.length < 2) return []
    const q = rechercheLien.toLowerCase()
    return ingredientsActifs.filter(i => i.nom.toLowerCase().includes(q)).sort((a,b) => a.nom.localeCompare(b.nom))
  }, [ingredientsActifs, rechercheLien])

  async function creerLienRecherche() {
    if (selectionRecherche.length < 2) return setToast('Sélectionne au moins 2 ingrédients')
    const nom = nomLienRecherche.trim()
    if (!nom) return setToast('Donne un nom au lien')
    await supabase.from('ingredients').update({ ingredient_base: nom }).in('id', selectionRecherche)
    await reload()
    setSelectionRecherche([])
    setNomLienRecherche('')
    setToast(`✓ Liés sous "${nom}"`)
  }

  function garderSepares(key) {
    const next = [...doublonsIgnores, key]
    setDoublonsIgnores(next)
    localStorage.setItem('doublons_ignores', JSON.stringify(next))
    setToast('✓ Ces ingrédients ne seront plus signalés comme doublons')
  }

  async function marquerPrefere(ing) {
    const nouveauEtat = !ing.prefere
    if (nouveauEtat && ing.ingredient_base) {
      await supabase.from('ingredients').update({ prefere: false }).eq('ingredient_base', ing.ingredient_base).neq('id', ing.id)
    }
    await supabase.from('ingredients').update({ prefere: nouveauEtat }).eq('id', ing.id)
    await reload()
  }

  async function fusionner(group) {
    const key = group[0].nom.toLowerCase().trim()
    const inclus = fusionInclus[key] || group.map(g => g.id)
    const items = group.filter(g => inclus.includes(g.id))
    if (items.length < 2) return setToast('Sélectionne au moins 2 ingrédients à fusionner')
    const keepId = inclus.includes(fusionChoix[key]) ? fusionChoix[key] : items[0].id
    const keep = items.find(g => g.id === keepId)
    const autres = items.filter(g => g.id !== keepId)
    if (!window.confirm(`Fusionner en gardant "${keep.nom}" (${keep.fournisseur || 'sans fournisseur'}) ? Les ${autres.length} autre(s) seront supprimé(s) et leurs recettes réattribuées.`)) return
    for (const o of autres) {
      await supabase.from('recette_ingredients').update({ ingredient_id: keep.id }).eq('ingredient_id', o.id)
      await supabase.from('ingredients').delete().eq('id', o.id)
    }
    await reload()
    setToast('✓ Fusionné')
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
            <button onClick={exportExcel} style={{ padding:'8px 14px', borderRadius:'8px', background:'transparent', border:'1px solid var(--border)', color:'inherit', cursor:'pointer', fontSize:'13px' }}>⬇ Export</button>
            <button onClick={() => setEditMode(!editMode)} style={{ padding:'8px 14px', borderRadius:'8px', background: editMode?'rgba(0,194,255,0.1)':'transparent', border:'1px solid '+(editMode?'#00C2FF':'var(--border)'), color: editMode?'#00C2FF':'inherit', cursor:'pointer', fontSize:'13px' }}>✏️ Modifier</button>
            <div style={{ position:'relative' }}>
              <button onClick={() => setShowImportMenu(!showImportMenu)} style={{ padding:'8px 16px', borderRadius:'8px', background:'#00C2FF', color:'#0A0F1E', fontWeight:'700', border:'none', cursor:'pointer', fontSize:'13px' }}>+ Ajouter</button>
              {showImportMenu && (
                <div style={{ position:'absolute', top:'110%', right:0, background:'var(--card)', border:'1px solid var(--border)', borderRadius:'8px', overflow:'hidden', zIndex:50, minWidth:'180px', boxShadow:'0 4px 16px rgba(0,0,0,0.3)' }}>
                  <button onClick={() => { setShowImportMenu(false); router.push('/dashboard/ingredients/nouveau') }} style={{ display:'block', width:'100%', textAlign:'left', padding:'10px 14px', background:'transparent', border:'none', color:'inherit', cursor:'pointer', fontSize:'13px' }} onMouseEnter={e=>e.currentTarget.style.background='var(--hover)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>✍️ Manuel</button>
                  <button onClick={() => { setShowImportMenu(false); router.push('/dashboard/ingredients/import') }} style={{ display:'block', width:'100%', textAlign:'left', padding:'10px 14px', background:'transparent', border:'none', color:'inherit', cursor:'pointer', fontSize:'13px' }} onMouseEnter={e=>e.currentTarget.style.background='var(--hover)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>📸 Photo (facture)</button>
                  <button onClick={() => { setShowImportMenu(false); document.getElementById('excel-input').click() }} style={{ display:'block', width:'100%', textAlign:'left', padding:'10px 14px', background:'transparent', border:'none', color:'inherit', cursor:'pointer', fontSize:'13px' }} onMouseEnter={e=>e.currentTarget.style.background='var(--hover)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>📊 Fichier Excel</button>
                  <button onClick={() => { setShowImportMenu(false); document.getElementById('catalogue-input').click() }} style={{ display:'block', width:'100%', textAlign:'left', padding:'10px 14px', background:'transparent', border:'none', color:'inherit', cursor:'pointer', fontSize:'13px' }} onMouseEnter={e=>e.currentTarget.style.background='var(--hover)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>📋 Liste de prix (comparaison)</button>
                </div>
              )}
              <input id="excel-input" type="file" accept=".xlsx,.xls" onChange={importExcel} style={{ display:'none' }} />
              <input id="catalogue-input" type="file" accept=".xlsx,.xls" onChange={importCatalogue} style={{ display:'none' }} />
            </div>
          </div>
        </div>

        {/* Onglets */}
        <div style={{ display:'flex', gap:'4px', marginBottom:'20px', borderBottom:'1px solid var(--border)', paddingBottom:'0' }}>
          {[['liste','📋 Liste'],['fournisseurs','🏪 Fournisseurs'],['doublons',`🔗 Doublons & Regroupement${doublonsDetectes.length ? ' ('+doublonsDetectes.length+')' : ''}`]].map(([k,l]) => (
            <button key={k} onClick={() => setOnglet(k)} style={{ padding:'8px 20px', borderRadius:'8px 8px 0 0', background: onglet===k ? 'var(--card)' : 'transparent', border: onglet===k ? '1px solid var(--border)' : '1px solid transparent', borderBottom: onglet===k ? '1px solid var(--card)' : '1px solid transparent', color: onglet===k ? 'inherit' : 'var(--muted)', cursor:'pointer', fontSize:'14px', marginBottom:'-1px' }}>
              {l}
            </button>
          ))}
        </div>

        {onglet === 'liste' && (
          <>
            {editMode && selected.length > 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'12px', padding:'10px 16px', background:'rgba(0,194,255,0.08)', border:'1px solid rgba(0,194,255,0.3)', borderRadius:'8px' }}>
                <span style={{ fontSize:'13px' }}>{selected.length} sélectionné(s)</span>
                <button onClick={regrouperSelection} style={{ padding:'6px 14px', borderRadius:'6px', background:'#00C2FF', color:'#0A0F1E', fontWeight:'700', border:'none', cursor:'pointer', fontSize:'13px' }}>🔗 Regrouper</button>
              </div>
            )}
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
                      <div style={{ fontWeight:'500', fontSize:'14px' }}><span onClick={(e) => { e.stopPropagation(); marquerPrefere(ing) }} title={ing.prefere ? 'Marqué préféré (clique pour enlever)' : 'Marquer comme préféré'} style={{ cursor:'pointer' }}>{(ingredientsUtilisesRecettes.has(ing.id) || ing.prefere) ? '⭐' : '☆'} </span>{ing.nom}{ing.ingredient_base && <span title={'Groupe: '+ing.ingredient_base} style={{ marginLeft:'8px', fontSize:'10px', padding:'2px 6px', borderRadius:'4px', background:'rgba(0,194,255,0.12)', color:'#00C2FF' }}>🔗 {ing.ingredient_base}</span>}</div>
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
            <div style={{ display:'grid', gridTemplateColumns:'260px 1fr', gap:'20px', marginBottom:'24px' }}>
              {/* Liste cherchable */}
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', padding:'16px' }}>
                <div style={{ display:'flex', gap:'6px', marginBottom:'12px' }}>
                  <button onClick={() => setAnalyseMode('produit')} style={{ flex:1, padding:'6px', borderRadius:'6px', border:'1px solid '+(analyseMode==='produit'?'#00C2FF':'var(--border)'), background: analyseMode==='produit'?'rgba(0,194,255,0.1)':'transparent', color: analyseMode==='produit'?'#00C2FF':'var(--muted)', cursor:'pointer', fontSize:'12px' }}>Par produit</button>
                  <button onClick={() => setAnalyseMode('fournisseur')} style={{ flex:1, padding:'6px', borderRadius:'6px', border:'1px solid '+(analyseMode==='fournisseur'?'#00C2FF':'var(--border)'), background: analyseMode==='fournisseur'?'rgba(0,194,255,0.1)':'transparent', color: analyseMode==='fournisseur'?'#00C2FF':'var(--muted)', cursor:'pointer', fontSize:'12px' }}>Fournisseur</button>
                </div>
                <input placeholder={analyseMode==='produit' ? 'Rechercher un produit' : 'Rechercher un fournisseur'} value={searchFiche} onChange={e => setSearchFiche(e.target.value)} style={{ ...inp, marginBottom:'8px' }} />
                {analyseMode === 'produit' && (
                  <select value={categorieFiche} onChange={e => setCategorieFiche(e.target.value)} style={{ ...inp, marginBottom:'10px' }}>
                    <option value=''>Toutes catégories</option>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                )}
                <style>{`.pilote-scroll::-webkit-scrollbar{width:6px}.pilote-scroll::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}.pilote-scroll::-webkit-scrollbar-track{background:transparent}`}</style>
                <div className="pilote-scroll" style={{ maxHeight:'340px', overflowY:'auto' }}>
                  {analyseMode === 'produit' ? produitsListe.map(g => (
                    <div key={g.nom} onClick={() => setGroupeSelectionne(g.nom)} style={{ padding:'8px 10px', borderRadius:'6px', fontSize:'13px', cursor:'pointer', background: groupeSelectionne===g.nom ? 'rgba(0,194,255,0.12)' : 'transparent', color: groupeSelectionne===g.nom ? '#00C2FF' : 'inherit' }}>{g.nom}</div>
                  )) : fournisseursListe.map(f => (
                    <div key={f} onClick={() => setFournisseurSelectionne(f)} style={{ padding:'8px 10px', borderRadius:'6px', fontSize:'13px', cursor:'pointer', background: fournisseurSelectionne===f ? 'rgba(0,194,255,0.12)' : 'transparent', color: fournisseurSelectionne===f ? '#00C2FF' : 'inherit' }}>{f}</div>
                  ))}
                  {analyseMode==='produit' && produitsListe.length===0 && <p style={{ color:'var(--muted)', fontSize:'12px' }}>Aucun résultat</p>}
                  {analyseMode==='fournisseur' && fournisseursListe.length===0 && <p style={{ color:'var(--muted)', fontSize:'12px' }}>Aucun résultat</p>}
                </div>
              </div>

              {/* Fiche */}
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', padding:'20px' }}>
                {analyseMode === 'produit' && (
                  groupeSelectionne && statsGroupe ? (
                    <>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
                        <span style={{ fontWeight:'700', fontSize:'18px' }}>{groupeSelectionne}</span>
                        <button onClick={exporterFiche} style={{ padding:'6px 12px', borderRadius:'6px', border:'1px solid var(--border)', background:'transparent', color:'var(--muted)', cursor:'pointer', fontSize:'12px' }}>⬇ Exporter</button>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px', marginBottom:'16px' }}>
                        <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:'8px', padding:'10px' }}>
                          <div style={{ fontSize:'11px', color:'var(--muted)' }}>Fournisseurs</div>
                          <div style={{ fontSize:'18px', fontWeight:'700' }}>{statsGroupe.nbFournisseurs}</div>
                        </div>
                        <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:'8px', padding:'10px' }}>
                          <div style={{ fontSize:'11px', color:'var(--muted)' }}>Meilleur prix</div>
                          <div style={{ fontSize:'18px', fontWeight:'700', color:'#00E5A0' }}>{statsGroupe.meilleurPrix?.toFixed(2)}$</div>
                        </div>
                        <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:'8px', padding:'10px' }}>
                          <div style={{ fontSize:'11px', color:'var(--muted)' }}>Dernier achat</div>
                          <div style={{ fontSize:'14px', fontWeight:'700' }}>{statsGroupe.dernierAchat ? new Date(statsGroupe.dernierAchat).toLocaleDateString('fr-CA') : '—'}</div>
                        </div>
                      </div>
                      {comparaisonGroupeData.chart.length > 0 && (
                        <ResponsiveContainer width="100%" height={150}>
                          <LineChart data={comparaisonGroupeData.chart}>
                            <XAxis dataKey="date" tick={{ fontSize:10, fill:'#8B9BB4' }} />
                            <YAxis tick={{ fontSize:10, fill:'#8B9BB4' }} />
                            <Tooltip contentStyle={{ background:'#1a1f2e', border:'1px solid rgba(0,194,255,0.2)', borderRadius:'8px', fontSize:'12px' }} />
                            <Legend wrapperStyle={{ fontSize:'11px' }} />
                            {comparaisonGroupeData.fournisseursGroupe.map((f,i) => <Line key={f} type="monotone" dataKey={f} stroke={FOURNISSEUR_COLORS[i % FOURNISSEUR_COLORS.length]} strokeWidth={2} dot={{ r:3 }} connectNulls />)}
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                      {comparaisonGroupeData.forecast && (
                        <p style={{ fontSize:'12px', color:'var(--muted)', marginTop:'8px' }}>
                          Tendance : <span style={{ color: comparaisonGroupeData.forecast.tauxAnnuel >= 0 ? '#FF4D6D' : '#00E5A0', fontWeight:'700' }}>{comparaisonGroupeData.forecast.tauxAnnuel >= 0 ? '+' : ''}{(comparaisonGroupeData.forecast.tauxAnnuel*100).toFixed(1)}%/an</span> → {comparaisonGroupeData.forecast.prixEstime.toFixed(2)}$ dans 1 an
                        </p>
                      )}
                      {indiceExterne && (
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginTop:'10px', padding:'10px 12px', background:'rgba(0,194,255,0.08)', border:'1px solid rgba(0,194,255,0.3)', borderRadius:'8px' }}>
                          <span style={{ fontSize:'13px', fontWeight:'700', color:'#00C2FF' }}>📊 Indice StatCan</span>
                          <span style={{ fontSize:'13px', color:'var(--muted)' }}>({indiceExterne.categorie}, Québec)</span>
                          <span style={{ fontSize:'14px', fontWeight:'700', color: indiceExterne.variation12mois>=0 ? '#FF4D6D' : '#00E5A0', marginLeft:'auto' }}>{indiceExterne.variation12mois>=0?'+':''}{indiceExterne.variation12mois}% / 12 mois</span>
                        </div>
                      )}
                      {economiePotentielle && <p style={{ fontSize:'12px', color:'#F5A623', marginTop:'8px' }}>💡 Économie potentielle sur tes recettes actuelles : {economiePotentielle.toFixed(2)}$ (si toujours acheté au meilleur prix)</p>}
                      <p style={{ fontSize:'11px', color:'var(--muted)', marginTop:'12px', marginBottom:'6px', textTransform:'uppercase' }}>Classement</p>
                      {statsGroupe.classement.map((ing,i) => (
                        <div key={ing.id}>
                          <div onClick={() => setDetailIngredientId(detailIngredientId === ing.id ? null : ing.id)} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom: detailIngredientId===ing.id ? 'none' : '1px solid var(--border)', fontSize:'13px', cursor:'pointer' }}>
                            <span>{i===0 && '🏆 '}<span onClick={(e) => { e.stopPropagation(); marquerPrefere(ing) }} title={ing.prefere ? 'Marqué préféré' : 'Marquer comme préféré'} style={{ cursor:'pointer' }}>{(ingredientsUtilisesRecettes.has(ing.id) || ing.prefere) ? '⭐' : '☆'}</span> {ing.fournisseur||'Sans fournisseur'}</span>
                            <span style={{ color: i===0 ? '#00E5A0' : 'var(--muted)' }}>{parseFloat(ing.prix_unitaire).toFixed(2)}$/{ing.unite}</span>
                          </div>
                          {detailIngredientId === ing.id && (
                            <div style={{ padding:'10px', marginBottom:'8px', background:'rgba(255,255,255,0.03)', borderRadius:'8px', borderBottom:'1px solid var(--border)' }}>
                              <p style={{ fontSize:'11px', color:'var(--muted)', marginBottom:'8px', textTransform:'uppercase' }}>Historique des commandes</p>
                              {detailHistorique.length > 0 ? (
                                <>
                                  <ResponsiveContainer width="100%" height={100}>
                                    <LineChart data={detailHistorique.map(h => ({ date: new Date(h.created_at).toLocaleDateString('fr-CA'), prix: parseFloat(h.prix) }))}>
                                      <XAxis dataKey="date" tick={{ fontSize:9, fill:'#8B9BB4' }} />
                                      <YAxis tick={{ fontSize:9, fill:'#8B9BB4' }} />
                                      <Tooltip contentStyle={{ background:'#1a1f2e', border:'1px solid rgba(0,194,255,0.2)', borderRadius:'8px', fontSize:'11px' }} />
                                      <Line type="monotone" dataKey="prix" stroke="#00C2FF" strokeWidth={2} dot={{ r:3 }} />
                                    </LineChart>
                                  </ResponsiveContainer>
                                  {detailHistorique.slice().reverse().map((h,j) => (
                                    <div key={j} style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', padding:'4px 0', borderBottom:'1px solid var(--border)' }}>
                                      <span>{new Date(h.created_at).toLocaleDateString('fr-CA')}{h.format_achat ? ' · '+h.format_achat : ''}</span>
                                      <span>{parseFloat(h.prix).toFixed(2)}$</span>
                                    </div>
                                  ))}
                                </>
                              ) : <p style={{ fontSize:'12px', color:'var(--muted)' }}>Aucun historique de commande enregistré pour cet ingrédient</p>}
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  ) : <p style={{ color:'var(--muted)', fontSize:'13px', textAlign:'center', marginTop:'40px' }}>Sélectionne un produit à gauche</p>
                )}

                {analyseMode === 'fournisseur' && (
                  fournisseurSelectionne && statsFournisseur ? (
                    <>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
                        <span style={{ fontWeight:'700', fontSize:'18px' }}>{fournisseurSelectionne}</span>
                        <button onClick={exporterFiche} style={{ padding:'6px 12px', borderRadius:'6px', border:'1px solid var(--border)', background:'transparent', color:'var(--muted)', cursor:'pointer', fontSize:'12px' }}>⬇ Exporter</button>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'10px', marginBottom:'16px' }}>
                        <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:'8px', padding:'10px' }}>
                          <div style={{ fontSize:'11px', color:'var(--muted)' }}>Produits</div>
                          <div style={{ fontSize:'18px', fontWeight:'700' }}>{statsFournisseur.nbProduits}</div>
                        </div>
                        <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:'8px', padding:'10px' }}>
                          <div style={{ fontSize:'11px', color:'var(--muted)' }}>Dernières commandes (total)</div>
                          <div style={{ fontSize:'18px', fontWeight:'700' }}>{statsFournisseur.totalDernieresCommandes.toFixed(2)}$</div>
                        </div>
                      </div>
                      <div className="pilote-scroll" style={{ maxHeight:'260px', overflowY:'auto' }}>
                        {produitsDuFournisseur.map(({ ing, forecast, alternative }) => (
                          <div key={ing.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                            <span style={{ fontSize:'13px' }}><span onClick={(e) => { e.stopPropagation(); marquerPrefere(ing) }} title={ing.prefere ? 'Marqué préféré' : 'Marquer comme préféré'} style={{ cursor:'pointer' }}>{(ingredientsUtilisesRecettes.has(ing.id) || ing.prefere) ? '⭐' : '☆'}</span> {ing.nom}</span>
                            <span style={{ fontSize:'12px', color:'var(--muted)', textAlign:'right' }}>
                              {parseFloat(ing.prix_unitaire).toFixed(2)}$/{ing.unite}
                              {forecast && <><br/><span style={{ color: forecast.tauxAnnuel >= 0 ? '#FF4D6D' : '#00E5A0' }}>{forecast.tauxAnnuel >= 0 ? '+' : ''}{(forecast.tauxAnnuel*100).toFixed(1)}%/an</span></>}
                              {alternative && <><br/><span style={{ color:'#F5A623' }}>⚠️ {alternative.fournisseur} : {parseFloat(alternative.prix_unitaire).toFixed(2)}$</span></>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : <p style={{ color:'var(--muted)', fontSize:'13px', textAlign:'center', marginTop:'40px' }}>Sélectionne un fournisseur à gauche</p>
                )}
              </div>
            </div>

            {/* Onglets Historique / Statistiques fournisseurs */}
            <div style={{ display:'flex', gap:'8px', marginBottom:'16px' }}>
              <button onClick={() => setSousOngletFournisseur('historique')} style={{ padding:'8px 16px', borderRadius:'8px', border:'1px solid '+(sousOngletFournisseur==='historique'?'#00C2FF':'var(--border)'), background: sousOngletFournisseur==='historique'?'rgba(0,194,255,0.1)':'transparent', color: sousOngletFournisseur==='historique'?'#00C2FF':'var(--muted)', cursor:'pointer', fontSize:'13px' }}>📜 Historique des achats</button>
              <button onClick={() => setSousOngletFournisseur('stats')} style={{ padding:'8px 16px', borderRadius:'8px', border:'1px solid '+(sousOngletFournisseur==='stats'?'#00C2FF':'var(--border)'), background: sousOngletFournisseur==='stats'?'rgba(0,194,255,0.1)':'transparent', color: sousOngletFournisseur==='stats'?'#00C2FF':'var(--muted)', cursor:'pointer', fontSize:'13px' }}>📈 Statistiques fournisseurs</button>
            </div>

            {sousOngletFournisseur === 'historique' && (
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', padding:'20px', marginBottom:'24px' }}>
                <p style={{ color:'var(--muted)', fontSize:'12px', marginBottom:'16px', textTransform:'uppercase', letterSpacing:'1px' }}>Historique des achats par ingrédient</p>
                <div style={{ display:'flex', gap:'10px', marginBottom:'16px' }}>
                  <input placeholder="Rechercher un ingrédient" value={searchComparatif} onChange={e => setSearchComparatif(e.target.value)} style={{ ...inp, flex:1 }} />
                  <select value={categorieComparatif} onChange={e => setCategorieComparatif(e.target.value)} style={{ ...inp, width:'180px' }}>
                    <option value=''>Toutes catégories</option>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                {comparaisonFiltree.length > 0 ? (
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
                        {comparaisonFiltree.map((row, i) => {
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
                ) : <p style={{ color:'var(--muted)', fontSize:'13px', textAlign:'center', padding:'24px' }}>{comparaisonData.length===0 ? 'Aucune comparaison disponible — ajoutez le même ingrédient chez plusieurs fournisseurs' : 'Aucun résultat pour ces filtres'}</p>}
              </div>
            )}

            {sousOngletFournisseur === 'stats' && (
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', padding:'20px', marginBottom:'24px' }}>
                <p style={{ color:'var(--muted)', fontSize:'12px', marginBottom:'16px', textTransform:'uppercase', letterSpacing:'1px' }}>Statistiques et tendances par fournisseur</p>
                <div style={{ display:'flex', gap:'10px', marginBottom:'16px', alignItems:'center', flexWrap:'wrap' }}>
                  <input placeholder="Rechercher un fournisseur" value={rechercheStatsF} onChange={e => setRechercheStatsF(e.target.value)} style={{ ...inp, flex:1, minWidth:'160px' }} />
                  <select value={categorieStatsF} onChange={e => setCategorieStatsF(e.target.value)} style={{ ...inp, width:'170px' }}>
                    <option value=''>Toutes catégories</option>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <div style={{ position:'relative' }}>
                    <button onClick={() => setShowSeuil(!showSeuil)} style={{ padding:'7px 12px', borderRadius:'8px', border:'1px solid var(--border)', background:'transparent', color:'var(--muted)', cursor:'pointer', fontSize:'12px' }}>⚙ Seuil {seuilAlerte}%</button>
                    {showSeuil && (
                      <div style={{ position:'absolute', top:'110%', right:0, zIndex:50, display:'flex', alignItems:'center', gap:'6px', padding:'8px 10px', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'8px', boxShadow:'0 4px 16px rgba(0,0,0,0.3)', whiteSpace:'nowrap' }}>
                        <span style={{ fontSize:'11px', color:'var(--muted)' }}>Seuil alerte</span>
                        <input type="number" value={seuilAlerte} onChange={e => setSeuilAlerte(parseFloat(e.target.value)||0)} style={{ ...inp, width:'55px', padding:'4px 6px' }} />
                        <span style={{ fontSize:'11px', color:'var(--muted)' }}>%/an</span>
                      </div>
                    )}
                  </div>
                  <button onClick={() => setModeDuel(!modeDuel)} style={{ padding:'7px 12px', borderRadius:'8px', border:'1px solid '+(modeDuel?'#00C2FF':'var(--border)'), background: modeDuel?'rgba(0,194,255,0.1)':'transparent', color: modeDuel?'#00C2FF':'var(--muted)', cursor:'pointer', fontSize:'12px' }}>⚔️ Mode duel</button>
                </div>



                {!modeDuel ? (
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                      <thead>
                        <tr style={{ borderBottom:'1px solid var(--border)' }}>
                          <th style={{ padding:'8px 12px', color:'var(--muted)', textAlign:'left', fontWeight:'600' }}>Fournisseur</th>
                          <th style={{ padding:'8px 12px', color:'var(--muted)', textAlign:'center', fontWeight:'600' }}>Produits</th>
                          <th style={{ padding:'8px 12px', color:'var(--muted)', textAlign:'center', fontWeight:'600' }}>Compétitivité</th>
                          <th style={{ padding:'8px 12px', color:'var(--muted)', textAlign:'center', fontWeight:'600' }}>Tendance</th>
                          <th style={{ padding:'8px 12px', color:'var(--muted)', textAlign:'right', fontWeight:'600' }}>Dépenses</th>
                          <th style={{ padding:'8px 12px', color:'var(--muted)', textAlign:'center', fontWeight:'600' }}>Commandes</th>
                          <th style={{ padding:'8px 12px', color:'var(--muted)', textAlign:'center', fontWeight:'600' }}>Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statsFournisseursFiltres.map(s => {
                          const statut = statutFournisseur(s.tendanceMoyenne)
                          return (
                            <tr key={s.fournisseur} onClick={() => { setAnalyseMode('fournisseur'); setFournisseurSelectionne(s.fournisseur) }} style={{ borderBottom:'1px solid var(--border)', cursor:'pointer' }} onMouseEnter={e=>e.currentTarget.style.background='var(--hover)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                              <td style={{ padding:'10px 12px', fontWeight:'500' }}>{s.fournisseur}</td>
                              <td style={{ padding:'10px 12px', textAlign:'center' }}>{s.nbProduits}</td>
                              <td style={{ padding:'10px 12px', textAlign:'center' }}>{s.competitivite == null ? '—' : s.competitivite+'%'}</td>
                              <td style={{ padding:'10px 12px', textAlign:'center', color: s.tendanceMoyenne == null ? 'var(--muted)' : s.tendanceMoyenne >= 0 ? '#FF4D6D' : '#00E5A0' }}>{s.tendanceMoyenne == null ? '—' : (s.tendanceMoyenne>=0?'+':'')+(s.tendanceMoyenne*100).toFixed(1)+'%/an'}</td>
                              <td style={{ padding:'10px 12px', textAlign:'right' }}>{s.depenses.toFixed(2)}$</td>
                              <td style={{ padding:'10px 12px', textAlign:'center' }}>{s.nbCommandes}</td>
                              <td style={{ padding:'10px 12px', textAlign:'center' }}><span style={{ background:statut.bg, color:statut.color, padding:'2px 10px', borderRadius:'6px', fontSize:'12px' }}>{statut.label}</span></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {statsFournisseursFiltres.length === 0 && <p style={{ color:'var(--muted)', fontSize:'13px', textAlign:'center', padding:'24px' }}>Aucun résultat</p>}
                  </div>
                ) : (
                  <div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'16px' }}>
                      <select value={duelA} onChange={e => setDuelA(e.target.value)} style={inp}>
                        <option value=''>Fournisseur A...</option>
                        {fournisseurs.map(f => <option key={f}>{f}</option>)}
                      </select>
                      <select value={duelB} onChange={e => setDuelB(e.target.value)} style={inp}>
                        <option value=''>Fournisseur B...</option>
                        {fournisseurs.map(f => <option key={f}>{f}</option>)}
                      </select>
                    </div>
                    {duelData && duelData.length > 0 ? (
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                        <thead>
                          <tr style={{ borderBottom:'1px solid var(--border)' }}>
                            <th style={{ padding:'8px 12px', color:'var(--muted)', textAlign:'left', fontWeight:'600' }}>Produit</th>
                            <th style={{ padding:'8px 12px', color:'var(--muted)', textAlign:'right', fontWeight:'600' }}>{duelA}</th>
                            <th style={{ padding:'8px 12px', color:'var(--muted)', textAlign:'right', fontWeight:'600' }}>{duelB}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {duelData.map((d,i) => {
                            const prixA = parseFloat(d.ingA.prix_unitaire), prixB = parseFloat(d.ingB.prix_unitaire)
                            return (
                            <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                              <td style={{ padding:'10px 12px' }}>{d.nom}</td>
                              <td style={{ padding:'10px 12px', textAlign:'right', color: prixA <= prixB ? '#00E5A0' : 'inherit', fontWeight: prixA <= prixB ? '700' : '400' }}>
                                <span onClick={() => marquerPrefere(d.ingA)} title={d.ingA.prefere ? 'Marqué préféré' : 'Marquer comme préféré'} style={{ cursor:'pointer', marginRight:'4px' }}>{d.ingA.prefere ? '⭐' : '☆'}</span>{prixA.toFixed(2)}$
                              </td>
                              <td style={{ padding:'10px 12px', textAlign:'right', color: prixB <= prixA ? '#00E5A0' : 'inherit', fontWeight: prixB <= prixA ? '700' : '400' }}>
                                <span onClick={() => marquerPrefere(d.ingB)} title={d.ingB.prefere ? 'Marqué préféré' : 'Marquer comme préféré'} style={{ cursor:'pointer', marginRight:'4px' }}>{d.ingB.prefere ? '⭐' : '☆'}</span>{prixB.toFixed(2)}$
                              </td>
                            </tr>
                          )})}
                        </tbody>
                      </table>
                    ) : <p style={{ color:'var(--muted)', fontSize:'13px', textAlign:'center', padding:'24px' }}>{duelA && duelB ? 'Aucun produit regroupé en commun entre ces deux fournisseurs (utilise "Regrouper sous" dans la fiche d\'un ingrédient pour les lier)' : 'Choisis 2 fournisseurs à comparer'}</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {onglet === 'doublons' && (
          <div>
            <p style={{ color:'var(--muted)', fontSize:'12px', marginBottom:'12px', textTransform:'uppercase', letterSpacing:'1px' }}>Doublons détectés (nom identique)</p>
            {doublonsDetectes.length === 0 && (
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', padding:'48px', textAlign:'center' }}>
                <p style={{ color:'var(--muted)', fontSize:'14px' }}>Aucun doublon détecté (basé sur le nom exact, une fois nettoyé des espaces/majuscules)</p>
              </div>
            )}
            {doublonsDetectes.map((group, gi) => {
              const key = group[0].nom.toLowerCase().trim()
              const inclus = fusionInclus[key] || group.map(g => g.id)
              return (
                <div key={gi} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', padding:'20px', marginBottom:'16px' }}>
                  <p style={{ fontWeight:'600', marginBottom:'12px' }}>{group[0].nom} <span style={{ color:'var(--muted)', fontSize:'12px', fontWeight:'400' }}>({group.length} exemplaires)</span></p>
                  {group.map(ing => {
                    const estInclus = inclus.includes(ing.id)
                    return (
                      <div key={ing.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                        <input type="checkbox" checked={estInclus} onChange={e => {
                          const next = e.target.checked ? [...inclus, ing.id] : inclus.filter(id => id !== ing.id)
                          setFusionInclus({ ...fusionInclus, [key]: next })
                        }} title="Inclure dans la fusion" />
                        <input type="radio" name={'fusion-'+gi} disabled={!estInclus} checked={(fusionChoix[key]||group[0].id)===ing.id} onChange={() => setFusionChoix({...fusionChoix,[key]:ing.id})} title="Garder celui-ci" />
                        <span style={{ fontSize:'13px', opacity: estInclus ? 1 : 0.4 }}>{ing.fournisseur||'Sans fournisseur'} · {ing.marque||'—'} · {parseFloat(ing.prix_unitaire).toFixed(2)}$/{ing.unite}</span>
                      </div>
                    )
                  })}
                  <div style={{ display:'flex', gap:'10px', marginTop:'12px' }}>
                    <button onClick={() => fusionner(group)} style={{ padding:'8px 16px', borderRadius:'8px', background:'#00C2FF', color:'#0A0F1E', fontWeight:'700', border:'none', cursor:'pointer', fontSize:'13px' }}>Fusionner {inclus.length} ingrédient(s) sélectionné(s)</button>
                    <button onClick={() => garderSepares(key)} style={{ padding:'8px 16px', borderRadius:'8px', background:'transparent', border:'1px solid var(--border)', color:'var(--muted)', cursor:'pointer', fontSize:'13px' }}>Garder séparés (ne plus signaler)</button>
                  </div>
                </div>
              )
            })}

            <p style={{ color:'var(--muted)', fontSize:'12px', margin:'28px 0 12px', textTransform:'uppercase', letterSpacing:'1px' }}>Créer un lien par recherche</p>
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', padding:'20px', marginBottom:'24px' }}>
              <input placeholder="Rechercher un mot (ex: lait, bacon...)" value={rechercheLien} onChange={e => setRechercheLien(e.target.value)} style={inp} />
              {rechercheLien.length >= 2 && (
                <>
                  <div style={{ maxHeight:'300px', overflowY:'auto', marginTop:'14px' }}>
                    {resultatsRechercheLien.map(ing => (
                      <label key={ing.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 0', borderBottom:'1px solid var(--border)', cursor:'pointer' }}>
                        <input type="checkbox" checked={selectionRecherche.includes(ing.id)} onChange={e => setSelectionRecherche(prev => e.target.checked ? [...prev, ing.id] : prev.filter(id => id !== ing.id))} />
                        <span style={{ fontSize:'13px' }}>{ing.nom} <span style={{ color:'var(--muted)' }}>· {ing.fournisseur||'Sans fournisseur'} · {parseFloat(ing.prix_unitaire).toFixed(2)}$/{ing.unite}{ing.ingredient_base ? ' · déjà lié: '+ing.ingredient_base : ''}</span></span>
                      </label>
                    ))}
                    {resultatsRechercheLien.length === 0 && <p style={{ color:'var(--muted)', fontSize:'13px', padding:'12px 0' }}>Aucun résultat</p>}
                  </div>
                  {selectionRecherche.length > 0 && (
                    <div style={{ display:'flex', gap:'8px', marginTop:'14px', alignItems:'center' }}>
                      <input value={nomLienRecherche} onChange={e => setNomLienRecherche(e.target.value)} placeholder="Nom du lien" style={{ ...inp, width:'200px' }} />
                      <button onClick={creerLienRecherche} style={{ padding:'8px 16px', borderRadius:'8px', background:'#00C2FF', color:'#0A0F1E', fontWeight:'700', border:'none', cursor:'pointer', fontSize:'13px' }}>Lier {selectionRecherche.length} ingrédient(s)</button>
                    </div>
                  )}
                </>
              )}
            </div>

            <p style={{ color:'var(--muted)', fontSize:'12px', margin:'28px 0 12px', textTransform:'uppercase', letterSpacing:'1px' }}>Suggestions de liens (mots communs détectés)</p>
            {suggestionsLiens.length === 0 && (
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', padding:'24px', textAlign:'center', marginBottom:'24px' }}>
                <p style={{ color:'var(--muted)', fontSize:'13px' }}>Aucune suggestion pour le moment</p>
              </div>
            )}
            {suggestionsLiens.map(({ mot, items }) => {
              const sel = selectionSuggestion[mot] || items.map(i => i.id)
              return (
                <div key={mot} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', padding:'20px', marginBottom:'16px' }}>
                  <p style={{ fontWeight:'600', marginBottom:'12px' }}>"{mot}" <span style={{ color:'var(--muted)', fontSize:'12px', fontWeight:'400' }}>({items.length} ingrédients trouvés)</span></p>
                  {items.map(ing => {
                    const estCoche = sel.includes(ing.id)
                    return (
                      <label key={ing.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'6px 0', borderBottom:'1px solid var(--border)', cursor:'pointer' }}>
                        <input type="checkbox" checked={estCoche} onChange={e => {
                          const next = e.target.checked ? [...sel, ing.id] : sel.filter(id => id !== ing.id)
                          setSelectionSuggestion({ ...selectionSuggestion, [mot]: next })
                        }} />
                        <span style={{ fontSize:'13px' }}>{ing.nom} <span style={{ color:'var(--muted)' }}>· {ing.fournisseur||'Sans fournisseur'}{ing.ingredient_base ? ' · déjà lié: '+ing.ingredient_base : ''}</span></span>
                      </label>
                    )
                  })}
                  <div style={{ display:'flex', gap:'8px', marginTop:'12px', alignItems:'center' }}>
                    <input value={nomsSuggestion[mot] ?? mot} onChange={e => setNomsSuggestion({ ...nomsSuggestion, [mot]: e.target.value })} style={{ ...inp, width:'200px' }} placeholder="Nom du lien" />
                    <button onClick={() => lierSuggestion(mot, items)} style={{ padding:'8px 16px', borderRadius:'8px', background:'#00C2FF', color:'#0A0F1E', fontWeight:'700', border:'none', cursor:'pointer', fontSize:'13px' }}>Lier {sel.length} ingrédient(s)</button>
                  </div>
                </div>
              )
            })}

            <p style={{ color:'var(--muted)', fontSize:'12px', margin:'28px 0 12px', textTransform:'uppercase', letterSpacing:'1px' }}>Ajouter à un lien existant</p>
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', padding:'20px', marginBottom:'24px' }}>
              <select value={lienChoisi} onChange={e => { setLienChoisi(e.target.value); setSelectionLien([]) }} style={inp}>
                <option value=''>Choisir un lien...</option>
                {groupesExistants.map(g => <option key={g}>{g}</option>)}
              </select>
              {lienChoisi && (
                <>
                  <div style={{ maxHeight:'340px', overflowY:'auto', marginTop:'14px' }}>
                    {ingredientsHorsLien.map(ing => (
                      <label key={ing.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 0', borderBottom:'1px solid var(--border)', cursor:'pointer' }}>
                        <input type="checkbox" checked={selectionLien.includes(ing.id)} onChange={e => setSelectionLien(prev => e.target.checked ? [...prev, ing.id] : prev.filter(id => id !== ing.id))} />
                        <span style={{ fontSize:'13px' }}>{ing.nom} <span style={{ color:'var(--muted)' }}>· {ing.fournisseur||'Sans fournisseur'} · {parseFloat(ing.prix_unitaire).toFixed(2)}$/{ing.unite}{ing.ingredient_base ? ' · lié: '+ing.ingredient_base : ''}</span></span>
                      </label>
                    ))}
                    {ingredientsHorsLien.length === 0 && <p style={{ color:'var(--muted)', fontSize:'13px', padding:'12px 0' }}>Tous les ingrédients actifs sont déjà dans ce lien</p>}
                  </div>
                  {selectionLien.length > 0 && (
                    <button onClick={ajouterAuLien} style={{ marginTop:'14px', padding:'8px 16px', borderRadius:'8px', background:'#00C2FF', color:'#0A0F1E', fontWeight:'700', border:'none', cursor:'pointer', fontSize:'13px' }}>Ajouter {selectionLien.length} ingrédient(s) au lien "{lienChoisi}"</button>
                  )}
                </>
              )}
            </div>

            <p style={{ color:'var(--muted)', fontSize:'12px', margin:'28px 0 12px', textTransform:'uppercase', letterSpacing:'1px' }}>Liens déjà créés</p>
            {liensExistantsDetail.length === 0 && (
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', padding:'24px', textAlign:'center' }}>
                <p style={{ color:'var(--muted)', fontSize:'13px' }}>Aucun lien créé pour l'instant</p>
              </div>
            )}
            {liensExistantsDetail.map(([nomLien, items]) => (
              <div key={nomLien} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', padding:'20px', marginBottom:'16px' }}>
                <p style={{ fontWeight:'600', marginBottom:'12px' }}>🔗 {nomLien} <span style={{ color:'var(--muted)', fontSize:'12px', fontWeight:'400' }}>({items.length} ingrédients)</span></p>
                {items.map(ing => (
                  <div key={ing.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ fontSize:'13px' }}>{ing.nom} <span style={{ color:'var(--muted)' }}>· {ing.fournisseur||'Sans fournisseur'} · {parseFloat(ing.prix_unitaire).toFixed(2)}$/{ing.unite}</span></span>
                    <button onClick={() => retirerDuLien(ing)} title="Retirer de ce lien" style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:'13px' }}>✕</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {conflitsImport && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', padding:'24px', maxWidth:'600px', width:'90%', maxHeight:'80vh', overflowY:'auto' }}>
            <p style={{ fontWeight:'700', marginBottom:'16px' }}>{conflitsImport.conflits.length} changement(s) de prix détecté(s)</p>
            {conflitsImport.conflits.map((c, i) => (
              <div key={i} style={{ marginBottom:'14px', paddingBottom:'14px', borderBottom:'1px solid var(--border)' }}>
                <p style={{ fontSize:'14px', marginBottom:'8px' }}>{c.existant.nom} ({c.existant.fournisseur||'sans fournisseur'}) — {parseFloat(c.existant.prix_unitaire).toFixed(2)}$ → {parseFloat(c.row.prix_unitaire).toFixed(2)}$</p>
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={() => setConflitsImport(prev => ({ ...prev, choix: prev.choix.map((v,j) => j===i ? 'remplacer' : v) }))} style={{ padding:'6px 12px', borderRadius:'6px', border:'1px solid '+(conflitsImport.choix[i]==='remplacer'?'#00C2FF':'var(--border)'), background: conflitsImport.choix[i]==='remplacer'?'rgba(0,194,255,0.15)':'transparent', color:'inherit', cursor:'pointer', fontSize:'12px' }}>Remplacer le prix</button>
                  <button onClick={() => setConflitsImport(prev => ({ ...prev, choix: prev.choix.map((v,j) => j===i ? 'nouveau' : v) }))} style={{ padding:'6px 12px', borderRadius:'6px', border:'1px solid '+(conflitsImport.choix[i]==='nouveau'?'#00C2FF':'var(--border)'), background: conflitsImport.choix[i]==='nouveau'?'rgba(0,194,255,0.15)':'transparent', color:'inherit', cursor:'pointer', fontSize:'12px' }}>Créer un ingrédient séparé</button>
                </div>
              </div>
            ))}
            <div style={{ display:'flex', gap:'10px', marginTop:'16px' }}>
              <button onClick={confirmerConflits} style={{ flex:1, padding:'10px', borderRadius:'8px', background:'#00C2FF', color:'#0A0F1E', fontWeight:'700', border:'none', cursor:'pointer' }}>Confirmer l'import</button>
              <button onClick={() => setConflitsImport(null)} style={{ flex:1, padding:'10px', borderRadius:'8px', background:'transparent', border:'1px solid var(--border)', color:'inherit', cursor:'pointer' }}>Annuler ces changements</button>
            </div>
          </div>
        </div>
      )}

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
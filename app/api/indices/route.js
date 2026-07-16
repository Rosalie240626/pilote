import { getSupabase } from '../../../lib/supabase-server'

const CATEGORIE_VERS_PRODUIT = {
  'Viandes': 'Meat',
  'Produits laitiers': 'Dairy products and eggs',
  'Fruits': 'Fresh fruit',
  'Légumes': 'Fresh vegetables',
  'Boulangerie': 'Bakery products',
  'Poissons': 'Fish, seafood and other marine products',
}
const PRODUIT_DEFAUT = 'Food purchased from stores'

let cache = {}

export async function GET(req) {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const categorie = searchParams.get('categorie') || ''
  const produitCherche = CATEGORIE_VERS_PRODUIT[categorie] || PRODUIT_DEFAUT

  if (cache[produitCherche] && Date.now() - cache[produitCherche].ts < 1000 * 60 * 60 * 24) {
    return Response.json(cache[produitCherche].data)
  }

  try {
    const metaRes = await fetch('https://www150.statcan.gc.ca/t1/wds/rest/getCubeMetadata', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ productId: 18100004 }])
    })
    const metaText = await metaRes.text()
    let meta
    try { meta = JSON.parse(metaText) } catch { throw new Error('Réponse StatCan non-JSON (statut ' + metaRes.status + '): ' + metaText.slice(0, 300)) }
    if (!Array.isArray(meta) || !meta[0] || !meta[0].object) throw new Error('Structure StatCan inattendue: ' + JSON.stringify(meta).slice(0, 500))
    const dims = meta[0].object.dimension
    const geoDim = dims.find(d => d.dimensionNameEn.includes('Geography'))
    const prodDim = dims.find(d => d.dimensionNameEn.includes('Products'))
    if (!geoDim || !prodDim) throw new Error('Dimensions introuvables. Dimensions disponibles: ' + dims.map(d => d.dimensionNameEn).join(', '))
    const geoMember = geoDim.member.find(m => m.memberNameEn === 'Quebec')
    const prodMember = prodDim.member.find(m => m.memberNameEn === produitCherche)
    if (!geoMember || !prodMember) throw new Error('Catégorie StatCan introuvable pour: ' + produitCherche + '. Exemples de produits disponibles: ' + prodDim.member.slice(0, 15).map(m => m.memberNameEn).join(' | '))

    const coordArr = Array(10).fill(0)
    dims.forEach(d => {
      const pos = d.dimensionPositionId - 1
      if (d === geoDim) coordArr[pos] = geoMember.memberId
      else if (d === prodDim) coordArr[pos] = prodMember.memberId
      else coordArr[pos] = d.member[0].memberId
    })
    const coordonnee = coordArr.join('.')

    const dataRes = await fetch('https://www150.statcan.gc.ca/t1/wds/rest/getDataFromCubePidCoordAndLatestNPeriods', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ productId: 18100004, coordinate: coordonnee, latestN: 13 }])
    })
    const dataText = await dataRes.text()
    let dataJson
    try { dataJson = JSON.parse(dataText) } catch { throw new Error('Réponse StatCan (données) non-JSON: ' + dataText.slice(0, 300)) }
    if (!Array.isArray(dataJson) || !dataJson[0] || !dataJson[0].object) throw new Error('Structure données inattendue pour coordonnée ' + coordonnee + ': ' + JSON.stringify(dataJson).slice(0, 500))
    const points = dataJson[0].object.vectorDataPoint
    if (!points || points.length === 0) throw new Error('Aucune donnée retournée pour coordonnée ' + coordonnee)
    const dernier = points[points.length - 1]
    const ilYa12Mois = points[0]
    const variation12mois = ((dernier.value / ilYa12Mois.value) - 1) * 100

    const resultat = {
      categorie: produitCherche,
      valeur: dernier.value,
      periode: dernier.refPer,
      variation12mois: Math.round(variation12mois * 10) / 10,
      source: 'Statistique Canada, tableau 18-10-0004-01 (IPC Québec)'
    }
    cache[produitCherche] = { ts: Date.now(), data: resultat }
    return Response.json(resultat)
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

import OpenAI from 'openai'
import { getSupabase, checkRateLimit } from '../../../lib/supabase-server'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req) {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })
  if (!(await checkRateLimit(supabase, user.id, 'prix', 20, 60))) return Response.json({ error: 'Trop de requêtes, réessaie dans un moment' }, { status: 429 })
  try {
    const { nom, cout, positionnement, style_cuisine, clientele, ville, prix_concurrents, prix_max } = await req.json()

    const prompt = `Tu es un expert en tarification de restaurant.
Plat: "${nom}", coût de production: ${cout}$
Restaurant: ${positionnement}, cuisine ${style_cuisine || 'générale'}, clientèle ${clientele || 'générale'}, ville: ${ville || 'Québec'}
${prix_concurrents ? `Prix moyen concurrents: ${prix_concurrents}$` : ''}
${prix_max ? `Prix maximum: ${prix_max}$` : ''}

Recherche le prix moyen de ce plat chez les concurrents similaires dans cette ville.
Réponds UNIQUEMENT avec ce JSON exact, sans texte avant ou après:
{"prix_suggere": 14.95, "prix_min": 12.95, "prix_max": 17.95, "food_cost_pct": 28.5, "prix_concurrents_trouves": "texte", "sources_consultees": "texte", "justification": "texte", "conseil": "texte"}`

    const response = await openai.responses.create({
      model: 'gpt-4o',
      tools: [{ type: 'web_search_preview' }],
      input: prompt,
    })

    const text = response.output
      .filter(o => o.type === 'message')
      .flatMap(o => o.content.filter(c => c.type === 'output_text').map(c => c.text))
      .join('')

    const clean = text.replace(/```json|```/g, '').trim()
    const jsonMatch = clean.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found: ' + clean)
    const result = JSON.parse(jsonMatch[0])

    return Response.json({
      prix_suggere: Number(result.prix_suggere) || 0,
      prix_min: Number(result.prix_min) || 0,
      prix_max: Number(result.prix_max) || 0,
      food_cost_pct: Number(result.food_cost_pct) || 0,
      prix_concurrents_trouves: Array.isArray(result.prix_concurrents_trouves) 
  ? result.prix_concurrents_trouves.map(r => `${r.restaurant}: ${r.prix}`).join(' · ')
  : String(result.prix_concurrents_trouves || ''),
      sources_consultees: String(result.sources_consultees || ''),
      justification: String(result.justification || ''),
      conseil: String(result.conseil || ''),
    })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

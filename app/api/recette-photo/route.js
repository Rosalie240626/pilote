import Anthropic from '@anthropic-ai/sdk'
import { getSupabase, checkRateLimit } from '../../../lib/supabase-server'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const maxDuration = 60

export async function POST(req) {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })
  if (!(await checkRateLimit(supabase, user.id, 'recette-photo', 15, 60))) return Response.json({ error: 'Trop de requêtes, réessaie dans un moment' }, { status: 429 })
  try {
    const { image } = await req.json()
    const base64 = image.split(',')[1]
    const mediaType = image.split(';')[0].split(':')[1]

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: `Analyse cette carte/fiche de recette. Extrais:
- nom: nom du plat
- categorie: catégorie du plat (ex: Plats principaux, Entrées, Desserts, Boissons)
- prix_vente: prix de vente si indiqué, sinon null
- ingredients: liste des ingrédients avec leur nom et leur quantité (en g, ml ou unité — convertis les lb/oz/tasses en g/ml si possible)

Réponds UNIQUEMENT en JSON:
{"nom": "nom du plat", "categorie": "Plats principaux", "prix_vente": null, "ingredients": [{"nom": "nom ingrédient", "quantite": 150, "unite": "g"}]}` }
        ]
      }]
    })

    const text = response.content[0].text
    const match = text.match(/\{[\s\S]*\}/)
    const result = JSON.parse(match ? match[0] : text)
    if (!result.ingredients) result.ingredients = []
    return Response.json(result)
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

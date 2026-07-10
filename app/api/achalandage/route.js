import OpenAI from 'openai'
import { getSupabase, checkRateLimit } from '../../../lib/supabase-server'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req) {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })
  if (!(await checkRateLimit(supabase, user.id, 'achalandage', 30, 60))) return Response.json({ error: 'Trop de requêtes, réessaie dans un moment' }, { status: 429 })
  try {
    const { evenement, date, impact, restaurant, positionnement, ville, nb_couverts } = await req.json()

    const prompt = `Tu es un expert en gestion de restaurant.
Événement: "${evenement}" le ${date}
Restaurant: ${restaurant || 'restaurant'}, ${positionnement || 'casual'}, ${ville || 'Québec'}, ${nb_couverts || 50} couverts
Impact estimé: ${impact}

Génère un plan d'action concret pour ce restaurant.
Réponds UNIQUEMENT en JSON valide:
{
  "couverts_prevus": 75,
  "ca_estime": 1500,
  "stock_supplementaire": 40,
  "actions": [
    "Commander 40% de stock supplémentaire 3 jours avant",
    "Prévoir 2 serveurs supplémentaires",
    "Préparer un menu spécial événement",
    "Augmenter les prix de 10% pour les plats populaires",
    "Ouvrir les réservations en ligne dès maintenant"
  ]
}`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    })

    const result = JSON.parse(response.choices[0].message.content)
    return Response.json(result)
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

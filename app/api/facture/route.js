cat > app/api/facture/route.js << 'EOF'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabase, checkRateLimit } from '../../../lib/supabase-server'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const maxDuration = 60

export async function POST(req) {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })
  if (!(await checkRateLimit(supabase, user.id, 'facture', 15, 60))) return Response.json({ error: 'Trop de requêtes, réessaie dans un moment' }, { status: 429 })
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
          { type: 'text', text: `Analyse cette facture de fournisseur restaurant. Pour chaque produit extrait:
- unite: "kg" pour les solides, "L" pour les liquides, "unité" pour le reste (ce que tu comptes à la pièce)
- qte_achetee: la quantité TOTALE achetée, convertie en unité de base ci-dessus (nombre seul, ex: si 5 caisses de 4kg → 20; si 4 paquets de 3 unités → 12; si lb, convertis en kg ×0.4536)
- format_achat: description courte du format d'achat tel qu'écrit sur la facture (ex: "caisse 4x5kg", "4 paquets de 3", "sac 20kg")
- prix_achat: montant total payé pour cette ligne
- categorie: Viandes, Produits laitiers, Légumes, Fruits, Épicerie, Boissons, Surgelés, Autre
Ne calcule pas le prix unitaire toi-même, l'application le fait automatiquement (prix_achat ÷ qte_achetee).

Réponds UNIQUEMENT en JSON:
{"fournisseur": "nom", "ingredients": [{"nom": "nom produit", "marque": "marque", "code_produit": "code", "categorie": "Viandes", "fournisseur": "nom", "unite": "kg", "qte_achetee": 20, "format_achat": "caisse 4x5kg", "prix_achat": 85.00}]}` }
        ]
      }]
    })

    const text = response.content[0].text
    const match = text.match(/\{[\s\S]*\}/)
    const result = JSON.parse(match ? match[0] : text)
    if (!result.ingredients) result.ingredients = []
    return Response.json(result)
  } catch (e) {
    return Response.json({ error: e.message, ingredients: [] }, { status: 500 })
  }
}
EOF
echo "✅ route.js remplacé"
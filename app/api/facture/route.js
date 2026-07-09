import Anthropic from '@anthropic-ai/sdk'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const maxDuration = 60

export async function POST(req) {
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
- prix_unitaire_kg: prix ramené au kg (si lb: ×2.205, si 100g: ×10, si caisse: ÷ poids total)
- prix_unitaire_100g: prix_unitaire_kg ÷ 10
- unite: toujours "kg" pour les solides, "L" pour les liquides, "unité" pour le reste
- categorie: Viandes, Produits laitiers, Légumes, Fruits, Épicerie, Boissons, Surgelés, Autre

Réponds UNIQUEMENT en JSON:
{"fournisseur": "nom", "ingredients": [{"nom": "nom produit", "marque": "marque", "code_produit": "code", "categorie": "Viandes", "fournisseur": "nom", "qte_achetee": "10 kg", "prix_achat": 85.00, "prix_unitaire": 8.50, "prix_unitaire_100g": 0.85, "unite": "kg", "note": "calcul effectué"}]}` }
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

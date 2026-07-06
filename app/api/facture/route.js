import Anthropic from '@anthropic-ai/sdk'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req) {
  try {
    const { image } = await req.json()
    const base64 = image.split(',')[1]
    const mediaType = image.split(';')[0].split(':')[1]

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: 'Analyse cette facture. Réponds UNIQUEMENT en JSON: {"fournisseur": "nom", "ingredients": [{"nom": "produit", "prix_unitaire": 0.00, "unite": "kg", "fournisseur": "nom"}]}' }
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

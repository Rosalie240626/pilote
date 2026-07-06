try {
  const { image } = await req.json()
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: image } },
        { type: 'text', text: `Analyse cette facture. Réponds UNIQUEMENT avec ce JSON, rien d'autre:
{"fournisseur": "nom", "ingredients": [{"nom": "produit", "prix_unitaire": 0.00, "unite": "kg", "fournisseur": "nom"}]}` }
      ]
    }],
    max_tokens: 1000,
  const text = response.choices[0].message.contentmax_tokens: 1000,
  })
  const text = response.choices[0].message.content
const match = text.match(/\{[\s\S]*\}/)
const result = JSON.parse(match ? match[0] : text)
  if (!result.ingredients) result.ingredients = []
  return Response.json(result)
} catch (e) {
  return Response.json({ error: e.message, ingredients: [] }, { status: 500 })
}
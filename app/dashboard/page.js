'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [stats, setStats] = useState({ recettes: 0, ingredients: 0, foodCost: 0, evenements: 0 })
  const [recettes, setRecettes] = useState([])
  const [evenements, setEvenements] = useState([])
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')
    const { data: member } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).single()
    if (!member) return
    const oid = member.organization_id

    const [r, i, e] = await Promise.all([
      supabase.from('recettes').select('*, recette_ingredients(grammage, ingredients(prix_unitaire, unite))').eq('organization_id', oid).order('created_at', { ascending: false }).limit(5),
      supabase.from('ingredients').select('id', { count: 'exact' }).eq('organization_id', oid),
      supabase.from('evenements').select('*').eq('organization_id', oid).gte('date_debut', new Date().toISOString().split('T')[0]).order('date_debut').limit(3),
    ])

    const recettesData = r.data || []
    const foodCosts = recettesData.filter(r => r.prix_vente).map(r => {
      const cout = r.recette_ingredients?.reduce((acc, ri) => {
        const facteur = (ri.ingredients?.unite === 'g' || ri.ingredients?.unite === 'ml') ? ri.grammage / 1000 : ri.grammage
        return acc + (ri.ingredients?.prix_unitaire || 0) * facteur
      }, 0) || 0
      return (cout / r.prix_vente) * 100
    })
    const fcMoyen = foodCosts.length ? foodCosts.reduce((a, b) => a + b, 0) / foodCosts.length : 0

    setStats({ recettes: recettesData.length, ingredients: i.count || 0, foodCost: fcMoyen.toFixed(1), evenements: e.data?.length || 0 })
    setRecettes(recettesData)
    setEvenements(e.data || [])
  }

  function coutRecette(r) {
    return r.recette_ingredients?.reduce((acc, ri) => {
      const facteur = (ri.ingredients?.unite === 'g' || ri.ingredients?.unite === 'ml') ? ri.grammage / 1000 : ri.grammage
      return acc + (ri.ingredients?.prix_unitaire || 0) * facteur
    }, 0) || 0
  }

  const fcColor = stats.foodCost <= 30 ? '#00E5A0' : stats.foodCost <= 35 ? '#F5A623' : '#FF4D6D'

  const KPI = ({ label, value, sub, color }) => (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px 24px' }}>
      <div style={{ color: 'var(--muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: '700', color: color || 'inherit' }}>{value}</div>
      {sub && <div style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '4px' }}>{sub}</div>}
    </div>
  )

  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>Tableau de bord</h1>
      <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '28px' }}>Vue d'ensemble de votre restaurant</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <KPI label="Food cost moyen" value={stats.foodCost > 0 ? `${stats.foodCost}%` : '—'} sub="Objectif ≤ 30%" color={fcColor} />
        <KPI label="Recettes" value={stats.recettes} sub="fiches créées" />
        <KPI label="Ingrédients" value={stats.ingredients} sub="en base" />
        <KPI label="Événements" value={stats.evenements} sub="à venir" color="#F5A623" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '600', fontSize: '14px' }}>Recettes récentes</span>
            <button onClick={() => router.push('/dashboard/recettes')} style={{ background: 'none', border: 'none', color: '#00C2FF', fontSize: '13px', cursor: 'pointer' }}>Voir tout →</button>
          </div>
          {recettes.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>Aucune recette — <span style={{ color: '#00C2FF', cursor: 'pointer' }} onClick={() => router.push('/dashboard/recettes/nouvelle')}>Créer la première</span></div>
          ) : recettes.map(r => {
            const cout = coutRecette(r)
            const fc = r.prix_vente ? ((cout / r.prix_vente) * 100).toFixed(1) : null
            return (
              <div key={r.id} onClick={() => router.push(`/dashboard/recettes/${r.id}`)} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', alignItems: 'center', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span style={{ fontWeight: '500', fontSize: '14px' }}>{r.nom}</span>
                <span style={{ color: 'var(--muted)', fontSize: '13px' }}>{cout.toFixed(2)}$ coût</span>
                <span style={{ fontSize: '13px' }}>{r.prix_vente ? `${r.prix_vente}$` : '—'}</span>
                <span style={{ fontSize: '13px', color: fc ? (fc <= 30 ? '#00E5A0' : fc <= 35 ? '#F5A623' : '#FF4D6D') : 'var(--muted)' }}>{fc ? `${fc}%` : '—'}</span>
              </div>
            )
          })}
        </div>

        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '600', fontSize: '14px' }}>Prochains événements</span>
            <button onClick={() => router.push('/dashboard/achalandage')} style={{ background: 'none', border: 'none', color: '#00C2FF', fontSize: '13px', cursor: 'pointer' }}>Voir tout →</button>
          </div>
          {evenements.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>Aucun événement à venir</div>
          ) : evenements.map(ev => (
            <div key={ev.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: '500', fontSize: '14px', marginBottom: '4px' }}>{ev.nom}</div>
              <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{new Date(ev.date_debut).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long' })}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

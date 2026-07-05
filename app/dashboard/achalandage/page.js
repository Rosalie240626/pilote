'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

const FERIES = [
  { nom: "Jour de l'An", date: '2026-01-01' },
  { nom: 'Vendredi Saint', date: '2026-04-03' },
  { nom: 'Journée des patriotes', date: '2026-05-18' },
  { nom: 'Fête nationale du Québec', date: '2026-06-24' },
  { nom: 'Fête du Canada', date: '2026-07-01' },
  { nom: 'Fête du Travail', date: '2026-09-07' },
  { nom: 'Action de grâce', date: '2026-10-12' },
  { nom: 'Noël', date: '2026-12-25' },
]

const SPECIAUX = [
  { nom: 'Grand Prix F1 Montréal', date: '2026-06-14', type: 'sport' },
  { nom: 'Festival de Jazz Montréal', date: '2026-06-27', type: 'festival' },
  { nom: 'Juste pour Rire', date: '2026-07-09', type: 'festival' },
  { nom: 'Osheaga', date: '2026-07-31', type: 'festival' },
]

const IMPACTS = [
  { value: 'tres_eleve', label: '🔥 Très élevé (+50%)', color: '#FF4D6D' },
  { value: 'eleve', label: '📈 Élevé (+30%)', color: '#F5A623' },
  { value: 'moyen', label: '➡️ Moyen (+15%)', color: '#00C2FF' },
  { value: 'faible', label: '📉 Faible (+5%)', color: '#8B9BB4' },
]

export default function Achalandage() {
  const [evenements, setEvenements] = useState([])
  const [orgId, setOrgId] = useState(null)
  const [org, setOrg] = useState(null)
  const [form, setForm] = useState({ nom: '', type: 'manuel', date_debut: '', impact_estime: 'moyen' })
  const [planIA, setPlanIA] = useState(null)
  const [loadingPlan, setLoadingPlan] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')
    const { data: member } = await supabase.from('organization_members').select('organization_id, organizations(*)').eq('user_id', user.id).single()
    if (!member) return router.push('/dashboard/restaurant')
    setOrgId(member.organization_id)
    setOrg(member.organizations)
    const { data } = await supabase.from('evenements').select('*').eq('organization_id', member.organization_id).order('date_debut')
    setEvenements(data || [])
  }

  async function ajouter(ev) {
    const { data } = await supabase.from('evenements').insert({ ...ev, organization_id: orgId }).select().single()
    setEvenements(prev => [...prev, data].sort((a, b) => new Date(a.date_debut) - new Date(b.date_debut)))
  }

  async function ajouterManuel() {
    if (!form.nom || !form.date_debut) return
    await ajouter(form)
    setForm({ nom: '', type: 'manuel', date_debut: '', impact_estime: 'moyen' })
    setShowForm(false)
  }

  async function genererPlan(ev) {
    setLoadingPlan(ev.id); setPlanIA(null)
    const res = await fetch('/api/achalandage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ evenement: ev.nom, date: ev.date_debut, impact: ev.impact_estime, restaurant: org?.nom, positionnement: org?.positionnement, ville: org?.ville, nb_couverts: org?.nb_couverts }) })
    setPlanIA({ ...await res.json(), evenementId: ev.id })
    setLoadingPlan(null)
  }

  async function supprimer(id) {
    await supabase.from('evenements').delete().eq('id', id)
    setEvenements(evenements.filter(e => e.id !== id))
  }

  const impactColor = v => IMPACTS.find(i => i.value === v)?.color || '#8B9BB4'
  const impactLabel = v => IMPACTS.find(i => i.value === v)?.label || v
  const joursRestants = d => { const diff = Math.ceil((new Date(d) - new Date()) / 86400000); return diff < 0 ? 'Passé' : diff === 0 ? "Aujourd'hui" : `Dans ${diff} j` }
  const inp = { width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'inherit', fontSize: '14px', boxSizing: 'border-box' }
  const aVenir = evenements.filter(e => new Date(e.date_debut) >= new Date())

  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>Achalandage</h1>
      <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '28px' }}>Anticipez les événements et préparez votre restaurant</p>

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
        <p style={{ color: 'var(--muted)', fontSize: '12px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Jours fériés & événements</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
          {FERIES.filter(f => !evenements.find(e => e.date_debut === f.date)).map(f => (
            <button key={f.date} onClick={() => ajouter({ nom: f.nom, type: 'ferie', date_debut: f.date, impact_estime: 'eleve' })} style={{ padding: '5px 12px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', fontSize: '13px' }}>+ {f.nom}</button>
          ))}
          {SPECIAUX.filter(e => !evenements.find(ev => ev.date_debut === e.date)).map(e => (
            <button key={e.date} onClick={() => ajouter({ nom: e.nom, type: e.type, date_debut: e.date, impact_estime: 'tres_eleve' })} style={{ padding: '5px 12px', borderRadius: '6px', background: 'transparent', border: '1px solid rgba(255,77,109,0.4)', color: '#FF4D6D', cursor: 'pointer', fontSize: '13px' }}>+ {e.nom}</button>
          ))}
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '7px 16px', borderRadius: '8px', background: '#00C2FF', color: '#0A0F1E', fontWeight: '700', border: 'none', cursor: 'pointer', fontSize: '13px' }}>+ Événement personnalisé</button>
        {showForm && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '10px', marginTop: '12px' }}>
            <input placeholder="Nom *" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} style={inp} />
            <input type="date" value={form.date_debut} onChange={e => setForm({ ...form, date_debut: e.target.value })} style={inp} />
            <select value={form.impact_estime} onChange={e => setForm({ ...form, impact_estime: e.target.value })} style={inp}>
              {IMPACTS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
            </select>
            <button onClick={ajouterManuel} style={{ padding: '8px 16px', borderRadius: '8px', background: '#00C2FF', color: '#0A0F1E', fontWeight: '700', border: 'none', cursor: 'pointer' }}>Ajouter</button>
          </div>
        )}
      </div>

      {aVenir.length > 0 && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontWeight: '600', fontSize: '14px' }}>Événements à venir</span>
          </div>
          {aVenir.map(ev => (
            <div key={ev.id} style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div>
                  <span style={{ fontWeight: '600', fontSize: '14px', marginRight: '12px' }}>{ev.nom}</span>
                  <span style={{ color: 'var(--muted)', fontSize: '13px' }}>{new Date(ev.date_debut).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ color: impactColor(ev.impact_estime), fontSize: '12px' }}>{impactLabel(ev.impact_estime)}</span>
                  <span style={{ color: impactColor(ev.impact_estime), fontSize: '12px', fontWeight: '600' }}>{joursRestants(ev.date_debut)}</span>
                  <button onClick={() => supprimer(ev.id)} style={{ background: 'none', border: 'none', color: '#FF4D6D', cursor: 'pointer', fontSize: '16px' }}>×</button>
                </div>
              </div>
              <button onClick={() => genererPlan(ev)} disabled={loadingPlan === ev.id} style={{ padding: '6px 16px', borderRadius: '6px', background: 'transparent', border: '1px solid rgba(0,194,255,0.3)', color: '#00C2FF', cursor: 'pointer', fontSize: '13px' }}>
                {loadingPlan === ev.id ? '⏳ Génération...' : '✨ Plan d\'action IA'}
              </button>
              {planIA?.evenementId === ev.id && (
                <div style={{ marginTop: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px', textAlign: 'center' }}>
                    <div><div style={{ color: 'var(--muted)', fontSize: '11px', marginBottom: '4px' }}>COUVERTS PRÉVUS</div><div style={{ fontWeight: '700', color: '#00C2FF' }}>{planIA.couverts_prevus}</div></div>
                    <div><div style={{ color: 'var(--muted)', fontSize: '11px', marginBottom: '4px' }}>CA ESTIMÉ</div><div style={{ fontWeight: '700', color: '#00E5A0' }}>{planIA.ca_estime}$</div></div>
                    <div><div style={{ color: 'var(--muted)', fontSize: '11px', marginBottom: '4px' }}>STOCK SUPP.</div><div style={{ fontWeight: '700', color: '#F5A623' }}>+{planIA.stock_supplementaire}%</div></div>
                  </div>
                  {planIA.actions?.map((a, i) => <div key={i} style={{ fontSize: '13px', marginBottom: '4px' }}>→ {a}</div>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {evenements.length === 0 && <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>Aucun événement — ajoutez des jours fériés ci-dessus</div>}
    </div>
  )
}

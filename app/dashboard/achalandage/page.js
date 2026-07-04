'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

const FERIES_QC = [
  { nom: "Jour de l'An", date: '2026-01-01' },
  { nom: 'Vendredi Saint', date: '2026-04-03' },
  { nom: 'Lundi de Pâques', date: '2026-04-06' },
  { nom: 'Journée des patriotes', date: '2026-05-18' },
  { nom: 'Fête nationale du Québec', date: '2026-06-24' },
  { nom: 'Fête du Canada', date: '2026-07-01' },
  { nom: 'Fête du Travail', date: '2026-09-07' },
  { nom: 'Action de grâce', date: '2026-10-12' },
  { nom: 'Noël', date: '2026-12-25' },
]

const EVENEMENTS_SPECIAUX = [
  { nom: 'Grand Prix F1 Montréal', date: '2026-06-14', type: 'sport' },
  { nom: 'Festival de Jazz Montréal', date: '2026-06-27', type: 'festival' },
  { nom: 'Festival Juste pour Rire', date: '2026-07-09', type: 'festival' },
  { nom: 'Osheaga', date: '2026-07-31', type: 'festival' },
  { nom: 'Grand Prix F1 Montréal 2027', date: '2027-06-13', type: 'sport' },
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
  const [form, setForm] = useState({ nom: '', type: 'manuel', date_debut: '', date_fin: '', impact_estime: 'moyen', notes: '' })
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

  async function ajouterFerie(f) {
    const { data } = await supabase.from('evenements').insert({ nom: f.nom, type: 'ferie', date_debut: f.date, impact_estime: 'eleve', organization_id: orgId }).select().single()
    setEvenements(prev => [...prev, data].sort((a, b) => new Date(a.date_debut) - new Date(b.date_debut)))
  }

  async function ajouterSpecial(e) {
    const { data } = await supabase.from('evenements').insert({ nom: e.nom, type: e.type, date_debut: e.date, impact_estime: 'tres_eleve', organization_id: orgId }).select().single()
    setEvenements(prev => [...prev, data].sort((a, b) => new Date(a.date_debut) - new Date(b.date_debut)))
  }

  async function ajouterManuel() {
    if (!form.nom || !form.date_debut) return
    const { data } = await supabase.from('evenements').insert({ ...form, organization_id: orgId }).select().single()
    setEvenements(prev => [...prev, data].sort((a, b) => new Date(a.date_debut) - new Date(b.date_debut)))
    setForm({ nom: '', type: 'manuel', date_debut: '', date_fin: '', impact_estime: 'moyen', notes: '' })
    setShowForm(false)
  }

  async function genererPlan(ev) {
    setLoadingPlan(ev.id)
    setPlanIA(null)
    const res = await fetch('/api/achalandage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        evenement: ev.nom,
        date: ev.date_debut,
        impact: ev.impact_estime,
        restaurant: org?.nom,
        positionnement: org?.positionnement,
        ville: org?.ville,
        nb_couverts: org?.nb_couverts,
      })
    })
    const data = await res.json()
    setPlanIA({ ...data, evenementId: ev.id })
    setLoadingPlan(null)
  }

  async function supprimer(id) {
    await supabase.from('evenements').delete().eq('id', id)
    setEvenements(evenements.filter(e => e.id !== id))
  }

  function couleurImpact(impact) {
    return IMPACTS.find(i => i.value === impact)?.color || '#8B9BB4'
  }

  function labelImpact(impact) {
    return IMPACTS.find(i => i.value === impact)?.label || impact
  }

  function joursRestants(date) {
    const diff = Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24))
    if (diff < 0) return 'Passé'
    if (diff === 0) return "Aujourd'hui"
    if (diff === 1) return 'Demain'
    return `Dans ${diff} jours`
  }

  const inp = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #1F2937', background: '#1F2937', color: 'white', fontSize: '14px', boxSizing: 'border-box' }
  const aVenir = evenements.filter(e => new Date(e.date_debut) >= new Date())
  const passes = evenements.filter(e => new Date(e.date_debut) < new Date())

  return (
    <div style={{ minHeight: '100vh', background: '#0A0F1E', color: 'white', fontFamily: 'sans-serif' }}>
      <div style={{ background: '#111827', borderBottom: '1px solid rgba(0,194,255,0.15)', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ color: '#00C2FF', fontWeight: '800', fontSize: '24px', margin: 0, cursor: 'pointer' }} onClick={() => router.push('/dashboard')}>PILOTE</h1>
        <span onClick={() => router.push('/dashboard')} style={{ color: '#8B9BB4', fontSize: '14px', cursor: 'pointer' }}>← Retour</span>
      </div>

      <div style={{ maxWidth: '900px', margin: '40px auto', padding: '0 24px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>📅 Opportunités d'achalandage</h2>
        <p style={{ color: '#8B9BB4', marginBottom: '32px' }}>Anticipe les événements et prépare ton restaurant à l'avance.</p>

        {/* Ajouter rapidement */}
        <div style={{ background: '#111827', border: '1px solid rgba(0,194,255,0.15)', borderRadius: '16px', padding: '24px', marginBottom: '16px' }}>
          <p style={{ color: '#8B9BB4', fontSize: '12px', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>Ajouter rapidement</p>
          
          <p style={{ color: '#F0F4FF', fontSize: '13px', marginBottom: '10px', fontWeight: '600' }}>🇨🇦 Jours fériés Québec</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
            {FERIES_QC.filter(f => !evenements.find(e => e.date_debut === f.date)).map(f => (
              <button key={f.date} onClick={() => ajouterFerie(f)}
                style={{ padding: '6px 14px', borderRadius: '100px', background: 'transparent', border: '1px solid #1F2937', color: '#8B9BB4', cursor: 'pointer', fontSize: '13px' }}>
                + {f.nom}
              </button>
            ))}
          </div>

          <p style={{ color: '#F0F4FF', fontSize: '13px', marginBottom: '10px', fontWeight: '600' }}>🏆 Événements majeurs</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
            {EVENEMENTS_SPECIAUX.filter(e => !evenements.find(ev => ev.date_debut === e.date)).map(e => (
              <button key={e.date} onClick={() => ajouterSpecial(e)}
                style={{ padding: '6px 14px', borderRadius: '100px', background: 'transparent', border: '1px solid #FF4D6D50', color: '#FF4D6D', cursor: 'pointer', fontSize: '13px' }}>
                + {e.nom}
              </button>
            ))}
          </div>

          <button onClick={() => setShowForm(!showForm)}
            style={{ padding: '8px 20px', borderRadius: '8px', background: '#00C2FF', color: '#0A0F1E', fontWeight: '700', border: 'none', cursor: 'pointer', fontSize: '13px' }}>
            + Événement personnalisé
          </button>

          {showForm && (
            <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '12px' }}>
              <input placeholder="Nom de l'événement *" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} style={inp} />
              <input type="date" value={form.date_debut} onChange={e => setForm({ ...form, date_debut: e.target.value })} style={inp} />
              <select value={form.impact_estime} onChange={e => setForm({ ...form, impact_estime: e.target.value })} style={inp}>
                {IMPACTS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
              <button onClick={ajouterManuel} style={{ padding: '10px', borderRadius: '8px', background: '#00C2FF', color: '#0A0F1E', fontWeight: '700', border: 'none', cursor: 'pointer' }}>
                Ajouter
              </button>
            </div>
          )}
        </div>

        {/* Événements à venir */}
        {aVenir.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <p style={{ color: '#00C2FF', fontSize: '13px', fontWeight: '700', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>À venir</p>
            <div style={{ display: 'grid', gap: '12px' }}>
              {aVenir.map(ev => (
                <div key={ev.id} style={{ background: '#111827', border: `1px solid ${couleurImpact(ev.impact_estime)}30`, borderRadius: '12px', padding: '20px 24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '4px' }}>{ev.nom}</div>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span style={{ color: '#8B9BB4', fontSize: '13px' }}>{new Date(ev.date_debut).toLocaleDateString('fr-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                        <span style={{ color: couleurImpact(ev.impact_estime), fontSize: '12px', fontWeight: '600' }}>{joursRestants(ev.date_debut)}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ color: couleurImpact(ev.impact_estime), fontSize: '13px' }}>{labelImpact(ev.impact_estime)}</span>
                      <button onClick={() => supprimer(ev.id)} style={{ background: 'none', border: 'none', color: '#FF4D6D', cursor: 'pointer', fontSize: '18px' }}>×</button>
                    </div>
                  </div>

                  <button onClick={() => genererPlan(ev)} disabled={loadingPlan === ev.id}
                    style={{ padding: '8px 20px', borderRadius: '8px', background: 'rgba(0,194,255,0.1)', border: '1px solid rgba(0,194,255,0.3)', color: '#00C2FF', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                    {loadingPlan === ev.id ? '⏳ Génération du plan...' : '✨ Générer plan d\'action IA'}
                  </button>

                  {planIA?.evenementId === ev.id && (
                    <div style={{ marginTop: '16px', background: '#0A0F1E', borderRadius: '10px', padding: '16px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ color: '#8B9BB4', fontSize: '11px', marginBottom: '4px' }}>COUVERTS PRÉVUS</div>
                          <div style={{ fontWeight: '700', fontSize: '20px', color: '#00C2FF' }}>{planIA.couverts_prevus}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ color: '#8B9BB4', fontSize: '11px', marginBottom: '4px' }}>CA ESTIMÉ</div>
                          <div style={{ fontWeight: '700', fontSize: '20px', color: '#00E5A0' }}>{planIA.ca_estime}$</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ color: '#8B9BB4', fontSize: '11px', marginBottom: '4px' }}>STOCK SUPPLÉMENTAIRE</div>
                          <div style={{ fontWeight: '700', fontSize: '20px', color: '#F5A623' }}>+{planIA.stock_supplementaire}%</div>
                        </div>
                      </div>
                      {planIA.actions && planIA.actions.length > 0 && (
                        <div>
                          <div style={{ color: '#8B9BB4', fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Actions recommandées</div>
                          {planIA.actions.map((a, i) => (
                            <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '6px', alignItems: 'flex-start' }}>
                              <span style={{ color: '#00C2FF', fontSize: '14px', marginTop: '1px' }}>→</span>
                              <span style={{ color: '#F0F4FF', fontSize: '13px' }}>{a}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {evenements.length === 0 && (
          <div style={{ background: '#111827', border: '1px solid rgba(0,194,255,0.15)', borderRadius: '16px', padding: '48px', textAlign: 'center' }}>
            <p style={{ color: '#8B9BB4' }}>Aucun événement — ajoutez des jours fériés ou des événements spéciaux ci-dessus</p>
          </div>
        )}
      </div>
    </div>
  )
}

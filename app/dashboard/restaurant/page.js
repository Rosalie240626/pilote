'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

const STYLES_CUISINE = ['Québécois','Américain','Italien','Français','Mexicain','Japonais','Chinois','Indien','Méditerranéen','Fusion','Végétarien','Autre']
const CLIENTELES = ['Familles','Professionnels','Touristes','Étudiants','Couples','Groupes','Locaux','Tous types']
const SERVICES_OPTS = ['Sur place','À emporter','Livraison','Terrasse','Réservations','Événements privés']
const JOURS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche']

export default function Restaurant() {
  const [org, setOrg] = useState({
    nom:'', type:'restaurant', positionnement:'casual', nb_couverts:'',
    adresse:'', ville:'', province:'Québec', code_postal:'', phone:'', email:'', site_web:'',
    heures_ouverture:{}, services:[], nb_employes:'',
    ticket_moyen_cible:'', ca_mensuel_cible:'', fc_moyen:'', food_cost_cible:30,
    style_cuisine:[], clientele_cible:[], concurrents:''
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [orgId, setOrgId] = useState(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => { loadOrg() }, [])

  async function loadOrg() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')
    const { data } = await supabase.from('organization_members').select('organization_id, organizations(*)').eq('user_id', user.id).single()
    if (data?.organizations) {
      setOrgId(data.organization_id)
      setOrg({ ...org, ...data.organizations, services: data.organizations.services || [], style_cuisine: data.organizations.style_cuisine || [], clientele_cible: data.organizations.clientele_cible || [], heures_ouverture: data.organizations.heures_ouverture || {} })
    }
  }

  async function save() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (orgId) {
      await supabase.from('organizations').update(org).eq('id', orgId)
      setMessage('Sauvegardé ✓')
    } else {
      const { data: newOrg, error } = await supabase.from('organizations').insert({ ...org, type: org.type || 'restaurant' }).select('id').single()
      if (error || !newOrg) { setMessage('Erreur: ' + (error?.message || 'inconnue')); setLoading(false); return }
      await supabase.from('organization_members').insert({ user_id: user.id, organization_id: newOrg.id, role: 'owner' })
      setOrgId(newOrg.id)
      setMessage('Restaurant créé ✓')
    }
    setLoading(false)
    setTimeout(() => setMessage(''), 3000)
  }

  function toggleArray(field, val) {
    const arr = org[field] || []
    setOrg({ ...org, [field]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] })
  }

  function setHeure(jour, type, val) {
    setOrg({ ...org, heures_ouverture: { ...org.heures_ouverture, [jour]: { ...org.heures_ouverture[jour], [type]: val } } })
  }

  const inp = { width:'100%', padding:'10px 12px', borderRadius:'8px', border:'1px solid #1F2937', background:'#1F2937', color:'white', fontSize:'14px', boxSizing:'border-box' }
  const card = { background:'#111827', border:'1px solid rgba(0,194,255,0.15)', borderRadius:'16px', padding:'24px', marginBottom:'16px' }
  const label = (t) => <label style={{ color:'#8B9BB4', fontSize:'12px', display:'block', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'1px' }}>{t}</label>

  const Chip = ({ val, field }) => {
    const active = (org[field] || []).includes(val)
    return <span onClick={() => toggleArray(field, val)} style={{ padding:'6px 14px', borderRadius:'100px', fontSize:'13px', cursor:'pointer', border:`1px solid ${active ? '#00C2FF' : '#1F2937'}`, background: active ? 'rgba(0,194,255,0.1)' : 'transparent', color: active ? '#00C2FF' : '#8B9BB4', marginRight:'8px', marginBottom:'8px', display:'inline-block' }}>{val}</span>
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0A0F1E', color:'white', fontFamily:'sans-serif' }}>
      <div style={{ background:'#111827', borderBottom:'1px solid rgba(0,194,255,0.15)', padding:'16px 32px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h1 style={{ color:'#00C2FF', fontWeight:'800', fontSize:'24px', margin:0, cursor:'pointer' }} onClick={() => router.push('/dashboard')}>PILOTE</h1>
        <span onClick={() => router.push('/dashboard')} style={{ color:'#8B9BB4', fontSize:'14px', cursor:'pointer' }}>← Retour</span>
      </div>

      <div style={{ maxWidth:'700px', margin:'40px auto', padding:'0 24px' }}>
        <h2 style={{ fontSize:'22px', fontWeight:'700', marginBottom:'32px' }}>🍽️ Profil du restaurant</h2>

        {/* Infos générales */}
        <div style={card}>
          <p style={{ color:'#00C2FF', fontSize:'13px', fontWeight:'700', marginBottom:'16px', textTransform:'uppercase', letterSpacing:'1px' }}>Infos générales</p>
          <div style={{ marginBottom:'16px' }}>
            {label('Nom du restaurant *')}
            <input value={org.nom} onChange={e => setOrg({...org, nom:e.target.value})} style={inp} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px' }}>
            <div>{label('Type')}
              <select value={org.type} onChange={e => setOrg({...org, type:e.target.value})} style={inp}>
                {['restaurant','bar','cafe','boulangerie','food_truck'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>{label('Positionnement')}
              <select value={org.positionnement} onChange={e => setOrg({...org, positionnement:e.target.value})} style={inp}>
                {[['economique','$ Économique'],['casual','$$ Casual'],['premium','$$$ Premium'],['gastronomique','$$$$ Gastronomique']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <div>{label('Email')}<input value={org.email||''} onChange={e => setOrg({...org, email:e.target.value})} style={inp} /></div>
            <div>{label('Téléphone')}<input value={org.phone||''} onChange={e => setOrg({...org, phone:e.target.value})} style={inp} /></div>
          </div>
          <div style={{ marginTop:'12px' }}>{label('Site web')}<input value={org.site_web||''} onChange={e => setOrg({...org, site_web:e.target.value})} placeholder="https://" style={inp} /></div>
        </div>

        {/* Adresse */}
        <div style={card}>
          <p style={{ color:'#00C2FF', fontSize:'13px', fontWeight:'700', marginBottom:'16px', textTransform:'uppercase', letterSpacing:'1px' }}>Adresse</p>
          <div style={{ marginBottom:'12px' }}>{label('Adresse')}<input value={org.adresse||''} onChange={e => setOrg({...org, adresse:e.target.value})} placeholder="123 rue Principale" style={inp} /></div>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:'12px' }}>
            <div>{label('Ville')}<input value={org.ville||''} onChange={e => setOrg({...org, ville:e.target.value})} style={inp} /></div>
            <div>{label('Province')}<input value={org.province||''} onChange={e => setOrg({...org, province:e.target.value})} style={inp} /></div>
            <div>{label('Code postal')}<input value={org.code_postal||''} onChange={e => setOrg({...org, code_postal:e.target.value})} style={inp} /></div>
          </div>
        </div>

        {/* Opérationnel */}
        <div style={card}>
          <p style={{ color:'#00C2FF', fontSize:'13px', fontWeight:'700', marginBottom:'16px', textTransform:'uppercase', letterSpacing:'1px' }}>Opérationnel</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px' }}>
            <div>{label('Nb couverts')}<input type="number" value={org.nb_couverts||''} onChange={e => setOrg({...org, nb_couverts:e.target.value})} style={inp} /></div>
            <div>{label('Nb employés')}<input type="number" value={org.nb_employes||''} onChange={e => setOrg({...org, nb_employes:e.target.value})} style={inp} /></div>
          </div>
          <div style={{ marginBottom:'16px' }}>
            {label('Services offerts')}
            <div style={{ marginTop:'8px' }}>{SERVICES_OPTS.map(s => <Chip key={s} val={s} field="services" />)}</div>
          </div>
          <div>
            {label('Heures d\'ouverture')}
            <div style={{ marginTop:'8px' }}>
              {JOURS.map(j => (
                <div key={j} style={{ display:'grid', gridTemplateColumns:'100px 1fr 1fr 80px', gap:'8px', marginBottom:'8px', alignItems:'center' }}>
                  <span style={{ color:'#8B9BB4', fontSize:'13px' }}>{j}</span>
                  <input type="time" value={org.heures_ouverture[j]?.ouverture||''} onChange={e => setHeure(j,'ouverture',e.target.value)} style={{...inp, padding:'6px 10px'}} />
                  <input type="time" value={org.heures_ouverture[j]?.fermeture||''} onChange={e => setHeure(j,'fermeture',e.target.value)} style={{...inp, padding:'6px 10px'}} />
                  <label style={{ display:'flex', alignItems:'center', gap:'6px', color:'#8B9BB4', fontSize:'12px', cursor:'pointer' }}>
                    <input type="checkbox" checked={org.heures_ouverture[j]?.ferme||false} onChange={e => setHeure(j,'ferme',e.target.checked)} />
                    Fermé
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Finances */}
        <div style={card}>
          <p style={{ color:'#00C2FF', fontSize:'13px', fontWeight:'700', marginBottom:'16px', textTransform:'uppercase', letterSpacing:'1px' }}>Finances</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px' }}>
            <div>{label('Moyenne de facture ($)')}<input type="number" value={org.ticket_moyen_cible||''} onChange={e => setOrg({...org, ticket_moyen_cible:e.target.value})} style={inp} /></div>
            <div>{label('CA mensuel cible ($)')}<input type="number" value={org.ca_mensuel_cible||''} onChange={e => setOrg({...org, ca_mensuel_cible:e.target.value})} style={inp} /></div>
            <div>{label('Food cost cible (%)')}<input type="number" value={org.food_cost_cible||''} onChange={e => setOrg({...org, food_cost_cible:e.target.value})} style={inp} /></div>
          </div>
        </div>

        {/* IA */}
        <div style={card}>
          <p style={{ color:'#00C2FF', fontSize:'13px', fontWeight:'700', marginBottom:'16px', textTransform:'uppercase', letterSpacing:'1px' }}>Pour l'IA — Personnalisation</p>
          <div style={{ marginBottom:'16px' }}>
            {label('Style de cuisine')}
            <div style={{ marginTop:'8px' }}>{STYLES_CUISINE.map(s => <Chip key={s} val={s} field="style_cuisine" />)}</div>
          </div>
          <div style={{ marginBottom:'16px' }}>
            {label('Clientèle cible')}
            <div style={{ marginTop:'8px' }}>{CLIENTELES.map(c => <Chip key={c} val={c} field="clientele_cible" />)}</div>
          </div>
          <div>{label('Concurrents directs')}<input value={org.concurrents||''} onChange={e => setOrg({...org, concurrents:e.target.value})} placeholder="Ex: Resto du coin, Burger Palace..." style={inp} /></div>
        </div>

        <button onClick={save} disabled={loading}
          style={{ width:'100%', padding:'14px', borderRadius:'8px', background:'#00C2FF', color:'#0A0F1E', fontWeight:'700', border:'none', cursor:'pointer', fontSize:'16px', marginBottom:'40px' }}>
          {loading ? 'Sauvegarde...' : 'Sauvegarder le profil'}
        </button>

        {message && <p style={{ color:'#00E5A0', textAlign:'center', marginTop:'-24px', marginBottom:'32px' }}>{message}</p>}
      </div>
    </div>
  )
}

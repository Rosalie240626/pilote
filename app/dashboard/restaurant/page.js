'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

const STYLES = ['Québécois','Américain','Italien','Français','Mexicain','Japonais','Fusion','Végétarien','Autre']
const CLIENTELES = ['Familles','Professionnels','Touristes','Étudiants','Couples','Groupes','Locaux']
const SERVICES = ['Sur place','À emporter','Livraison','Terrasse','Réservations','Événements privés']

export default function Restaurant() {
  const [org, setOrg] = useState({ nom:'', type:'restaurant', positionnement:'casual', nb_couverts:'', adresse:'', ville:'', province:'Québec', code_postal:'', phone:'', email:'', site_web:'', nb_employes:'', ticket_moyen_cible:'', ca_mensuel_cible:'', food_cost_cible:30, style_cuisine:[], clientele_cible:[], services:[], concurrents:'' })
  const [orgId, setOrgId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')
    const { data } = await supabase.from('organization_members').select('organization_id, organizations(*)').eq('user_id', user.id).single()
    if (data?.organizations) { setOrgId(data.organization_id); setOrg(o => ({ ...o, ...data.organizations, services: data.organizations.services||[], style_cuisine: data.organizations.style_cuisine||[], clientele_cible: data.organizations.clientele_cible||[] })) }
  }

  async function save() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (orgId) { await supabase.from('organizations').update(org).eq('id', orgId); setMessage('Sauvegardé ✓') }
    else { const { data: n } = await supabase.from('organizations').insert({ ...org }).select('id').single(); await supabase.from('organization_members').insert({ user_id: user.id, organization_id: n.id, role: 'owner' }); setOrgId(n.id); setMessage('Créé ✓') }
    setLoading(false); setTimeout(() => setMessage(''), 3000)
  }

  const toggle = (field, val) => setOrg(o => ({ ...o, [field]: o[field].includes(val) ? o[field].filter(v => v !== val) : [...o[field], val] }))
  const inp = { width:'100%', padding:'8px 12px', borderRadius:'8px', border:'1px solid var(--border)', background:'transparent', color:'inherit', fontSize:'14px', boxSizing:'border-box' }
  const card = { background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px', padding:'20px', marginBottom:'16px' }
  const Chip = ({ val, field }) => { const on = org[field].includes(val); return <span onClick={() => toggle(field, val)} style={{ padding:'5px 12px', borderRadius:'100px', fontSize:'13px', cursor:'pointer', border:`1px solid ${on ? '#00C2FF' : 'var(--border)'}`, color: on ? '#00C2FF' : 'var(--muted)', marginRight:'6px', marginBottom:'6px', display:'inline-block' }}>{val}</span> }

  return (
    <div style={{ maxWidth:'700px' }}>
      <h1 style={{ fontSize:'22px', fontWeight:'700', marginBottom:'4px' }}>Mon Restaurant</h1>
      <p style={{ color:'var(--muted)', fontSize:'14px', marginBottom:'28px' }}>Profil complet — calibre les recommandations de l'IA</p>

      <div style={card}>
        <p style={{ color:'var(--muted)', fontSize:'12px', marginBottom:'12px', textTransform:'uppercase', letterSpacing:'1px' }}>Général</p>
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:'12px', marginBottom:'12px' }}>
          <div><label style={{ color:'var(--muted)', fontSize:'12px', display:'block', marginBottom:'4px' }}>Nom *</label><input value={org.nom} onChange={e => setOrg({...org, nom:e.target.value})} style={inp} /></div>
          <div><label style={{ color:'var(--muted)', fontSize:'12px', display:'block', marginBottom:'4px' }}>Type</label>
            <select value={org.type} onChange={e => setOrg({...org, type:e.target.value})} style={inp}>
              {['restaurant','bar','cafe','boulangerie','food_truck'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div><label style={{ color:'var(--muted)', fontSize:'12px', display:'block', marginBottom:'4px' }}>Positionnement</label>
            <select value={org.positionnement} onChange={e => setOrg({...org, positionnement:e.target.value})} style={inp}>
              {[['economique','$ Éco'],['casual','$$ Casual'],['premium','$$$ Premium'],['gastronomique','$$$$ Gastro']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px' }}>
          <div><label style={{ color:'var(--muted)', fontSize:'12px', display:'block', marginBottom:'4px' }}>Email</label><input value={org.email||''} onChange={e => setOrg({...org, email:e.target.value})} style={inp} /></div>
          <div><label style={{ color:'var(--muted)', fontSize:'12px', display:'block', marginBottom:'4px' }}>Téléphone</label><input value={org.phone||''} onChange={e => setOrg({...org, phone:e.target.value})} style={inp} /></div>
          <div><label style={{ color:'var(--muted)', fontSize:'12px', display:'block', marginBottom:'4px' }}>Site web</label><input value={org.site_web||''} onChange={e => setOrg({...org, site_web:e.target.value})} style={inp} /></div>
        </div>
      </div>

      <div style={card}>
        <p style={{ color:'var(--muted)', fontSize:'12px', marginBottom:'12px', textTransform:'uppercase', letterSpacing:'1px' }}>Adresse</p>
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:'12px' }}>
          <div><label style={{ color:'var(--muted)', fontSize:'12px', display:'block', marginBottom:'4px' }}>Adresse</label><input value={org.adresse||''} onChange={e => setOrg({...org, adresse:e.target.value})} style={inp} /></div>
          <div><label style={{ color:'var(--muted)', fontSize:'12px', display:'block', marginBottom:'4px' }}>Ville</label><input value={org.ville||''} onChange={e => setOrg({...org, ville:e.target.value})} style={inp} /></div>
          <div><label style={{ color:'var(--muted)', fontSize:'12px', display:'block', marginBottom:'4px' }}>Code postal</label><input value={org.code_postal||''} onChange={e => setOrg({...org, code_postal:e.target.value})} style={inp} /></div>
        </div>
      </div>

      <div style={card}>
        <p style={{ color:'var(--muted)', fontSize:'12px', marginBottom:'12px', textTransform:'uppercase', letterSpacing:'1px' }}>Opérationnel</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px', marginBottom:'12px' }}>
          <div><label style={{ color:'var(--muted)', fontSize:'12px', display:'block', marginBottom:'4px' }}>Couverts</label><input type="number" value={org.nb_couverts||''} onChange={e => setOrg({...org, nb_couverts:e.target.value})} style={inp} /></div>
          <div><label style={{ color:'var(--muted)', fontSize:'12px', display:'block', marginBottom:'4px' }}>Employés</label><input type="number" value={org.nb_employes||''} onChange={e => setOrg({...org, nb_employes:e.target.value})} style={inp} /></div>
          <div><label style={{ color:'var(--muted)', fontSize:'12px', display:'block', marginBottom:'4px' }}>Food cost cible (%)</label><input type="number" value={org.food_cost_cible||''} onChange={e => setOrg({...org, food_cost_cible:e.target.value})} style={inp} /></div>
        </div>
        <label style={{ color:'var(--muted)', fontSize:'12px', display:'block', marginBottom:'6px' }}>Services</label>
        <div>{SERVICES.map(s => <Chip key={s} val={s} field="services" />)}</div>
      </div>

      <div style={card}>
        <p style={{ color:'var(--muted)', fontSize:'12px', marginBottom:'12px', textTransform:'uppercase', letterSpacing:'1px' }}>Finances</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px' }}>
          <div><label style={{ color:'var(--muted)', fontSize:'12px', display:'block', marginBottom:'4px' }}>Ticket moyen ($)</label><input type="number" value={org.ticket_moyen_cible||''} onChange={e => setOrg({...org, ticket_moyen_cible:e.target.value})} style={inp} /></div>
          <div><label style={{ color:'var(--muted)', fontSize:'12px', display:'block', marginBottom:'4px' }}>CA mensuel cible ($)</label><input type="number" value={org.ca_mensuel_cible||''} onChange={e => setOrg({...org, ca_mensuel_cible:e.target.value})} style={inp} /></div>
          <div><label style={{ color:'var(--muted)', fontSize:'12px', display:'block', marginBottom:'4px' }}>Food cost cible (%)</label><input type="number" value={org.food_cost_cible||''} onChange={e => setOrg({...org, food_cost_cible:e.target.value})} style={inp} /></div>
        </div>
      </div>

      <div style={card}>
        <p style={{ color:'var(--muted)', fontSize:'12px', marginBottom:'12px', textTransform:'uppercase', letterSpacing:'1px' }}>Pour l'IA</p>
        <label style={{ color:'var(--muted)', fontSize:'12px', display:'block', marginBottom:'6px' }}>Style de cuisine</label>
        <div style={{ marginBottom:'12px' }}>{STYLES.map(s => <Chip key={s} val={s} field="style_cuisine" />)}</div>
        <label style={{ color:'var(--muted)', fontSize:'12px', display:'block', marginBottom:'6px' }}>Clientèle cible</label>
        <div style={{ marginBottom:'12px' }}>{CLIENTELES.map(c => <Chip key={c} val={c} field="clientele_cible" />)}</div>
        <label style={{ color:'var(--muted)', fontSize:'12px', display:'block', marginBottom:'4px' }}>Concurrents</label>
        <input value={org.concurrents||''} onChange={e => setOrg({...org, concurrents:e.target.value})} placeholder="Ex: Resto du coin, Burger Palace..." style={inp} />
      </div>

      <button onClick={save} disabled={loading} style={{ width:'100%', padding:'11px', borderRadius:'8px', background:'#00C2FF', color:'#0A0F1E', fontWeight:'700', border:'none', cursor:'pointer', marginBottom:'8px' }}>
        {loading ? 'Sauvegarde...' : 'Sauvegarder'}
      </button>
      {message && <p style={{ color:'#00E5A0', textAlign:'center', fontSize:'14px' }}>{message}</p>}
    </div>
  )
}

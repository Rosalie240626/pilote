'use client'
import { useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login')
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit() {
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return setMessage(error.message)
      router.push('/dashboard')
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) return setMessage(error.message)
      setMessage('Vérifie ton email pour confirmer ton compte.')
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0A0F1E', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'sans-serif' }}>
      <div style={{ background:'#111827', padding:'40px', borderRadius:'16px', width:'100%', maxWidth:'400px', border:'1px solid rgba(0,194,255,0.15)' }}>
        <h1 style={{ color:'#00C2FF', fontSize:'32px', fontWeight:'800', margin:'0 0 8px' }}>PILOTE</h1>
        <p style={{ color:'#8B9BB4', marginBottom:'32px' }}>Copilote financier pour restaurateurs</p>

        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
          style={{ width:'100%', padding:'12px', borderRadius:'8px', border:'1px solid #1F2937', background:'#1F2937', color:'white', marginBottom:'12px', boxSizing:'border-box' }} />
        <input placeholder="Mot de passe" type="password" value={password} onChange={e => setPassword(e.target.value)}
          style={{ width:'100%', padding:'12px', borderRadius:'8px', border:'1px solid #1F2937', background:'#1F2937', color:'white', marginBottom:'20px', boxSizing:'border-box' }} />

        <button onClick={handleSubmit}
          style={{ width:'100%', padding:'12px', borderRadius:'8px', background:'#00C2FF', color:'#0A0F1E', fontWeight:'700', border:'none', cursor:'pointer', fontSize:'16px' }}>
          {mode === 'login' ? 'Se connecter' : "Créer un compte"}
        </button>

        {message && <p style={{ color:'#F5A623', marginTop:'16px', fontSize:'14px' }}>{message}</p>}

        <p style={{ color:'#8B9BB4', marginTop:'20px', textAlign:'center', fontSize:'14px', cursor:'pointer' }}
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? "Pas de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
        </p>
      </div>
    </div>
  )
}
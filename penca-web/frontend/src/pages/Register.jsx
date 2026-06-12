import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'

export default function Register() {
  const { register, loading } = useAuth()
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [err, setErr] = useState('')
  const navigate = useNavigate()

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErr('')
    try {
      await register(form.username, form.email, form.password)
      navigate('/')
    } catch (e) {
      setErr(e.response?.data?.detail || 'Error al registrarse')
    }
  }

  return (
    <div className="auth-container">
      <h1>🏆 Registrate</h1>
      <p style={{ textAlign: 'center', color: '#666', marginBottom: 20 }}>Sumate a la Penca del Mundial 2026</p>
      {err && <div className="error">{err}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Usuario</label>
          <input name="username" value={form.username} onChange={handleChange} required minLength={3} autoFocus />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input name="email" type="email" value={form.email} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label>Contraseña</label>
          <input name="password" type="password" value={form.password} onChange={handleChange} required minLength={6} />
        </div>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Creando...' : 'Crear cuenta'}
        </button>
      </form>
      <div className="auth-switch">
        ¿Ya tenés cuenta? <Link to="/login">Iniciá sesión</Link>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'

export default function Login() {
  const { login, loading } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setErr('')
    try {
      await login(username, password)
      navigate('/')
    } catch (e) {
      setErr(e.response?.data?.detail || 'Error al iniciar sesión')
    }
  }

  return (
    <div className="auth-container">
      <span className="auth-badge">🏆</span>
      <h1>Penca Mundial 2026</h1>
      <p className="tagline">Pronosticá, sumá puntos y levantá la copa</p>
      {err && <div className="error">{err}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Usuario</label>
          <input value={username} onChange={e => setUsername(e.target.value)} required autoFocus />
        </div>
        <div className="form-group">
          <label>Contraseña</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
      <div className="auth-switch">
        ¿Sin cuenta? <Link to="/register">Registrate</Link>
      </div>
    </div>
  )
}

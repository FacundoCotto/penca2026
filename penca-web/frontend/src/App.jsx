import { Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Predict from './pages/Predict.jsx'
import Ranking from './pages/Ranking.jsx'
import History from './pages/History.jsx'

function Protected({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return children
}

function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  if (!user) return null

  const links = [
    { to: '/', label: '🏠 Dashboard' },
    { to: '/predict', label: '🎯 Pronósticos' },
    { to: '/ranking', label: '🏆 Ranking' },
    { to: '/history', label: '📊 Historial' },
  ]

  return (
    <nav className="navbar">
      <div className="navbar-brand">⚽ Penca del Mundial 2026</div>
      <div className="navbar-links">
        {links.map(l => (
          <Link key={l.to} to={l.to}
            className={location.pathname === l.to ? 'active' : ''}>
            {l.label}
          </Link>
        ))}
      </div>
      <div className="navbar-user">
        <span>👤 {user.username}{user.is_admin && ' (admin)'}</span>
        <button onClick={() => { logout(); navigate('/login') }}>Salir</button>
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <div className="app">
      <Navbar />
      <main className="content">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/predict" element={<Protected><Predict /></Protected>} />
          <Route path="/ranking" element={<Protected><Ranking /></Protected>} />
          <Route path="/history" element={<Protected><History /></Protected>} />
          <Route path="/history/:userId" element={<Protected><History /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

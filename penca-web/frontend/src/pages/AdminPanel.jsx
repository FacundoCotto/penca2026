import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'

const fmtDate = d => new Date(d).toLocaleString('es-AR', {
  day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
})

export default function AdminPanel() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ key: 'created_at', dir: 1 })
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    api.get('/admin/users')
      .then(r => setUsers(r.data))
      .catch(e => setMsg({ type: 'error', text: e.response?.data?.detail || 'Error al cargar usuarios' }))
      .finally(() => setLoading(false))
  }, [])

  async function forceSync() {
    setSyncing(true)
    setMsg(null)
    try {
      await api.post('/matches/sync')
      setMsg({ type: 'ok', text: 'Sincronización con el feed oficial ejecutada correctamente.' })
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || 'Error al sincronizar' })
    } finally {
      setSyncing(false)
    }
  }

  function toggleSort(key) {
    setSort(s => s.key === key ? { key, dir: -s.dir } : { key, dir: 1 })
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? users.filter(u => u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      : users
    return [...filtered].sort((a, b) => {
      const va = a[sort.key] ?? '', vb = b[sort.key] ?? ''
      if (va < vb) return -sort.dir
      if (va > vb) return sort.dir
      return 0
    })
  }, [users, search, sort])

  if (loading) return <div className="loading">Cargando panel de administración...</div>

  const totalPreds = users.reduce((s, u) => s + u.predictions_count, 0)
  const active = users.filter(u => u.predictions_count > 0).length

  const Th = ({ k, children }) => (
    <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort(k)}>
      {children}{sort.key === k ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
    </th>
  )

  return (
    <div>
      <h1>🛡️ Panel de administración</h1>
      <p className="page-sub">
        Los partidos y resultados se actualizan <b>automáticamente</b> desde el feed oficial del Mundial 2026.
        No se requiere carga manual.
      </p>

      {msg && <div className={msg.type === 'ok' ? 'success' : 'error'}>{msg.text}</div>}

      <div className="kpi-grid">
        <div className="kpi azul">
          <div className="kpi-label">Usuarios registrados</div>
          <div className="kpi-value">{users.length}</div>
        </div>
        <div className="kpi verde">
          <div className="kpi-label">Usuarios activos</div>
          <div className="kpi-value">{active}</div>
        </div>
        <div className="kpi amarillo">
          <div className="kpi-label">Pronósticos totales</div>
          <div className="kpi-value">{totalPreds}</div>
        </div>
      </div>

      <div className="admin-toolbar">
        <input
          type="search"
          placeholder="Buscar por usuario o email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="btn-sm btn-gold" disabled={syncing} onClick={forceSync}>
          {syncing ? 'Sincronizando...' : '🔄 Sincronizar fixture ahora'}
        </button>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <Th k="id">ID</Th>
              <Th k="username">Usuario</Th>
              <Th k="email">Email</Th>
              <th>Rol</th>
              <Th k="created_at">Registrado</Th>
              <Th k="predictions_count">Pronósticos</Th>
              <Th k="exact_hits">Exactos</Th>
              <Th k="total_points">Puntos</Th>
              <Th k="last_prediction_at">Última actividad</Th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(u => (
              <tr key={u.id}>
                <td style={{ color: 'var(--text-faint)' }}>{u.id}</td>
                <td style={{ fontWeight: 700 }}>{u.username}</td>
                <td style={{ color: 'var(--text-dim)' }}>{u.email}</td>
                <td>
                  <span className={`role-pill ${u.is_admin ? 'admin' : 'player'}`}>
                    {u.is_admin ? 'Admin' : 'Jugador'}
                  </span>
                </td>
                <td>{fmtDate(u.created_at)}</td>
                <td>{u.predictions_count}</td>
                <td>{u.exact_hits}</td>
                <td style={{ fontWeight: 700, color: 'var(--gold)' }}>{u.total_points}</td>
                <td>{u.last_prediction_at ? fmtDate(u.last_prediction_at) : '—'}</td>
                <td><Link className="btn-sm" to={`/history/${u.id}`}>Historial</Link></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-faint)' }}>Sin usuarios para mostrar.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'

export default function History() {
  const { userId } = useParams()
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const targetId = userId ? parseInt(userId, 10) : user.id
  const isMine = targetId === user.id

  useEffect(() => {
    const url = isMine ? '/predictions/me' : `/predictions/history/${targetId}`
    api.get(url).then(r => setItems(r.data)).finally(() => setLoading(false))
  }, [targetId])

  if (loading) return <div className="loading">Cargando historial...</div>

  const filtered = items.filter(it => {
    if (filter === 'finished') return it.match.is_finished
    if (filter === 'pending') return !it.match.is_finished
    return true
  })

  const total = items.filter(i => i.match.is_finished).reduce((s, i) => s + i.points, 0)
  const exact = items.filter(i => i.points === 5).length

  return (
    <div>
      <h1>📊 Historial {isMine ? '(mío)' : `de usuario #${targetId}`}</h1>
      {!isMine && <Link to="/ranking" style={{ color: 'var(--cyan)', textDecoration: 'none', fontWeight: 600 }}>← Volver al ranking</Link>}

      <div className="kpi-grid" style={{ marginTop: 16 }}>
        <div className="kpi verde">
          <div className="kpi-label">Puntos totales</div>
          <div className="kpi-value">{total}</div>
        </div>
        <div className="kpi amarillo">
          <div className="kpi-label">Aciertos exactos</div>
          <div className="kpi-value">{exact}</div>
        </div>
        <div className="kpi azul">
          <div className="kpi-label">Pronósticos</div>
          <div className="kpi-value">{items.length}</div>
        </div>
      </div>

      <div className="filter-bar">
        <select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">Todos</option>
          <option value="finished">Finalizados</option>
          <option value="pending">Pendientes</option>
        </select>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Fase</th>
              <th>Partido</th>
              <th>Mi apuesta</th>
              <th>Resultado real</th>
              <th>Puntos</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(it => {
              const m = it.match
              const date = new Date(m.match_date).toLocaleDateString('es-AR')
              const ptsClass = it.points === 5 ? 'gold' : it.points === 3 ? 'silver' : ''
              return (
                <tr key={m.id} className={ptsClass}>
                  <td>{date}</td>
                  <td style={{ fontSize: 12 }}>
                    {m.phase}{m.group_name ? ` · ${m.group_name}` : ''}
                  </td>
                  <td>{m.home_team} vs {m.away_team}</td>
                  <td><b>{it.home_goals} - {it.away_goals}</b></td>
                  <td>
                    {m.is_finished
                      ? <b style={{ color: 'var(--cyan)' }}>{m.home_goals} - {m.away_goals}</b>
                      : <span className="badge pending">Pendiente</span>}
                  </td>
                  <td>
                    {m.is_finished
                      ? <b style={{ color: it.points >= 3 ? 'var(--green)' : it.points === 1 ? 'var(--text-dim)' : 'var(--red)' }}>{it.points} pts</b>
                      : '—'}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-faint)' }}>Sin pronósticos para mostrar.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

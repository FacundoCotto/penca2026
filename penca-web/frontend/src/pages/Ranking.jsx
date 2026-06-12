import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'

export default function Ranking() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/ranking').then(r => setRows(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading">Cargando ranking...</div>

  const maxPts = Math.max(1, ...rows.map(r => r.total_points))

  return (
    <div>
      <h1>🏆 Ranking de la Penca</h1>
      <p className="page-sub">Ordenado por puntos totales. En caso de empate, gana quien más aciertos exactos tenga.</p>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th style={{ width: 60 }}>Pos.</th>
              <th>Participante</th>
              <th>Pronósticos</th>
              <th>Exactos</th>
              <th>Puntos</th>
              <th style={{ width: 200 }}>Progreso</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.user_id} className={i < 3 ? ['gold','silver','bronze'][i] : ''}>
                <td>{i < 3 ? ['🥇','🥈','🥉'][i] : ''} {r.position}</td>
                <td>{r.username}</td>
                <td>{r.predictions_count}</td>
                <td>{r.exact_hits}</td>
                <td><b>{r.total_points}</b></td>
                <td>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${(r.total_points / maxPts) * 100}%` }} />
                  </div>
                </td>
                <td>
                  <Link className="btn-sm" to={`/history/${r.user_id}`}>Ver historial</Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-faint)' }}>Sin participantes todavía.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

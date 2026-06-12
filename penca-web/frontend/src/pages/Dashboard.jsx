import { useEffect, useState } from 'react'
import { api } from '../api'

function MatchCard({ m }) {
  const finished = m.is_finished
  const date = new Date(m.match_date).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  })
  return (
    <div className={`match-card ${finished ? 'finished' : 'pending'}`}>
      <div>
        <div className="match-meta">
          {m.phase}{m.group_name ? ` · Grupo ${m.group_name}` : ''} · {date}
          {' '}<span className={`badge ${finished ? 'finished' : 'pending'}`}>
            {finished ? 'Finalizado' : 'Próximo'}
          </span>
        </div>
        <div className="match-team local">{m.home_team}</div>
      </div>
      <div className={`match-score ${!finished ? 'pending' : ''}`}>
        {finished ? `${m.home_goals} - ${m.away_goals}` : 'vs'}
      </div>
      <div className="match-team visit">{m.away_team}</div>
    </div>
  )
}

export default function Dashboard() {
  const [matches, setMatches] = useState([])
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.get('/matches'), api.get('/ranking')])
      .then(([m, r]) => { setMatches(m.data); setRanking(r.data) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading">Cargando...</div>

  const finished = matches.filter(m => m.is_finished)
  const pending = matches.filter(m => !m.is_finished)
  const totalPredictions = ranking.reduce((s, r) => s + r.predictions_count, 0)
  const totalExact = ranking.reduce((s, r) => s + r.exact_hits, 0)

  return (
    <div>
      <h1>🏟️ Dashboard del torneo</h1>
      <p className="page-sub">Resultados y fixture actualizados automáticamente desde el feed oficial del Mundial 2026.</p>

      <div className="kpi-grid">
        <div className="kpi azul">
          <div className="kpi-label">Participantes</div>
          <div className="kpi-value">{ranking.length}</div>
        </div>
        <div className="kpi verde">
          <div className="kpi-label">Partidos jugados</div>
          <div className="kpi-value">{finished.length}<span style={{fontSize:14,opacity:.7}}> / {matches.length}</span></div>
        </div>
        <div className="kpi rojo">
          <div className="kpi-label">Total pronósticos</div>
          <div className="kpi-value">{totalPredictions}</div>
        </div>
        <div className="kpi amarillo">
          <div className="kpi-label">Aciertos exactos</div>
          <div className="kpi-value">{totalExact}</div>
        </div>
      </div>

      <div className="card">
        <h2>🥇 Podio actual</h2>
        {ranking.length === 0 ? <p>Sin participantes aún.</p> : (
          <table>
            <thead><tr><th>#</th><th>Participante</th><th>Puntos</th><th>Aciertos exactos</th></tr></thead>
            <tbody>
              {ranking.slice(0, 3).map((r, i) => (
                <tr key={r.user_id} className={['gold','silver','bronze'][i]}>
                  <td>{['🥇','🥈','🥉'][i]} {r.position}</td>
                  <td>{r.username}</td>
                  <td>{r.total_points}</td>
                  <td>{r.exact_hits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>⚽ Resultados recientes</h2>
        {finished.length === 0 ? <p>Aún no hay partidos finalizados.</p> : (
          <div className="match-list">
            {finished.slice(-6).reverse().map(m => <MatchCard key={m.id} m={m} />)}
          </div>
        )}
      </div>

      <div className="card">
        <h2>📅 Próximos partidos</h2>
        {pending.length === 0 ? <p>No quedan partidos por jugar.</p> : (
          <div className="match-list">
            {pending.slice(0, 6).map(m => <MatchCard key={m.id} m={m} />)}
          </div>
        )}
      </div>
    </div>
  )
}

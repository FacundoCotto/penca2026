import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'

const hasStarted = m => new Date(m.match_date) <= new Date()

export default function Predict() {
  const [matches, setMatches] = useState([])
  const [myPreds, setMyPreds] = useState({})  // match_id -> {home, away, points}
  const [drafts, setDrafts] = useState({})    // match_id -> {home, away}
  const [filter, setFilter] = useState('all')
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)

  async function reload() {
    const [m, p] = await Promise.all([api.get('/matches'), api.get('/predictions/me')])
    setMatches(m.data)
    const dict = {}
    p.data.forEach(x => { dict[x.match.id] = { home: x.home_goals, away: x.away_goals, points: x.points } })
    setMyPreds(dict)
  }

  useEffect(() => { reload().finally(() => setLoading(false)) }, [])

  function setDraft(matchId, key, val) {
    setDrafts(d => ({ ...d, [matchId]: { ...d[matchId], [key]: val } }))
  }

  async function savePrediction(match) {
    const draft = drafts[match.id] || {}
    const existing = myPreds[match.id] || {}
    const home = draft.home ?? existing.home
    const away = draft.away ?? existing.away
    if (home === undefined || away === undefined || home === '' || away === '') {
      setMsg({ type: 'error', text: 'Completá ambos goles antes de guardar' })
      return
    }
    setSaving(match.id)
    setMsg(null)
    try {
      await api.post('/predictions', {
        match_id: match.id,
        home_goals: parseInt(home, 10),
        away_goals: parseInt(away, 10),
      })
      setMsg({ type: 'ok', text: `Pronóstico guardado: ${match.home_team} ${home} - ${away} ${match.away_team}` })
      setDrafts(d => { const { [match.id]: _, ...rest } = d; return rest })
      await reload()
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || 'Error al guardar' })
    } finally { setSaving(null) }
  }

  const filtered = useMemo(() => {
    if (filter === 'pending') return matches.filter(m => !m.is_finished)
    if (filter === 'finished') return matches.filter(m => m.is_finished)
    if (filter === 'mine') return matches.filter(m => myPreds[m.id])
    return matches
  }, [matches, myPreds, filter])

  if (loading) return <div className="loading">Cargando...</div>

  return (
    <div>
      <h1>🎯 Mis pronósticos</h1>
      <p className="page-sub">
        Cargá tu predicción de goles antes del inicio de cada partido.{' '}
        <b style={{ color: 'var(--gold)' }}>Resultado exacto: 5 pts</b> · Ganador + diferencia: 3 pts · Solo ganador: 1 pt.
      </p>

      {msg && <div className={msg.type === 'ok' ? 'success' : 'error'}>{msg.text}</div>}

      <div className="filter-bar">
        <select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">Todos los partidos</option>
          <option value="pending">Solo pendientes</option>
          <option value="finished">Solo finalizados</option>
          <option value="mine">Solo con mi pronóstico</option>
        </select>
      </div>

      <div>
        {filtered.map(m => {
          const pred = myPreds[m.id]
          const draft = drafts[m.id] || {}
          const home = draft.home ?? pred?.home ?? ''
          const away = draft.away ?? pred?.away ?? ''
          const started = hasStarted(m)
          const locked = m.is_finished || started
          const pts = pred?.points ?? 0
          const ptsClass = pts === 5 ? 'exact' : pts === 3 ? 'good' : pts === 1 ? '' : 'zero'

          return (
            <div key={m.id} className={`predict-row ${locked ? 'locked' : ''}`}>
              <div className="info">
                <div className="phase">
                  {m.phase}{m.group_name && ` · Grupo ${m.group_name}`} · {new Date(m.match_date).toLocaleString('es-AR')}
                </div>
                <div className="teams">{m.home_team} vs {m.away_team}</div>
                {m.is_finished ? (
                  <div style={{ fontSize: 12, color: 'var(--cyan)' }}>
                    Resultado oficial: <b>{m.home_goals} - {m.away_goals}</b>
                  </div>
                ) : started && (
                  <span className="badge live">En juego · pronóstico cerrado</span>
                )}
              </div>
              <input type="number" min="0" max="30"
                     value={home}
                     disabled={locked}
                     onChange={e => setDraft(m.id, 'home', e.target.value)} />
              <div className="vs">-</div>
              <input type="number" min="0" max="30"
                     value={away}
                     disabled={locked}
                     onChange={e => setDraft(m.id, 'away', e.target.value)} />
              {locked ? (
                <div className={`points ${ptsClass}`}>
                  {m.is_finished ? `${pts} pts` : pred ? 'Jugado' : '—'}
                </div>
              ) : (
                <button className="btn-sm" disabled={saving === m.id} onClick={() => savePrediction(m)}>
                  {saving === m.id ? '...' : (pred ? 'Editar' : 'Guardar')}
                </button>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-faint)' }}>No hay partidos con ese filtro.</p>}
      </div>
    </div>
  )
}

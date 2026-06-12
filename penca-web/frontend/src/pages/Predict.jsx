import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth.jsx'

export default function Predict() {
  const { user } = useAuth()
  const [matches, setMatches] = useState([])
  const [myPreds, setMyPreds] = useState({})  // match_id -> {home, away, points}
  const [drafts, setDrafts] = useState({})    // match_id -> {home, away}
  const [filter, setFilter] = useState('all')
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [showAdmin, setShowAdmin] = useState(false)
  const [resultDraft, setResultDraft] = useState({})

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

  async function saveResult(match) {
    const draft = resultDraft[match.id] || {}
    if (draft.home === undefined || draft.away === undefined) return
    try {
      await api.put(`/matches/${match.id}/result`, {
        home_goals: parseInt(draft.home, 10),
        away_goals: parseInt(draft.away, 10),
      })
      setMsg({ type: 'ok', text: 'Resultado oficial cargado' })
      setResultDraft(d => { const { [match.id]: _, ...rest } = d; return rest })
      await reload()
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || 'Error al guardar resultado' })
    }
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
      <p style={{ color: '#666' }}>
        Cargá tu predicción de goles. <b>Resultado exacto: 5 pts</b> · Ganador + diferencia: 3 pts · Solo ganador: 1 pt.
        Una vez que el partido finaliza, no se puede modificar.
      </p>

      {msg && <div className={msg.type === 'ok' ? 'success' : 'error'}>{msg.text}</div>}

      <div className="filter-bar">
        <select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">Todos los partidos</option>
          <option value="pending">Solo pendientes</option>
          <option value="finished">Solo finalizados</option>
          <option value="mine">Solo con mi pronóstico</option>
        </select>
        {user?.is_admin && (
          <button className="btn-sm" onClick={() => setShowAdmin(s => !s)}>
            {showAdmin ? '🔒 Ocultar carga de resultados' : '⚙️ Cargar resultados (admin)'}
          </button>
        )}
      </div>

      <div>
        {filtered.map(m => {
          const pred = myPreds[m.id]
          const draft = drafts[m.id] || {}
          const home = draft.home ?? pred?.home ?? ''
          const away = draft.away ?? pred?.away ?? ''
          const locked = m.is_finished
          const pts = pred?.points ?? 0
          const ptsClass = pts === 5 ? 'exact' : pts === 3 ? 'good' : pts === 1 ? '' : 'zero'

          return (
            <div key={m.id} className={`predict-row ${locked ? 'locked' : ''}`}>
              <div className="info">
                <div className="phase">
                  {m.phase}{m.group_name && ` · Grupo ${m.group_name}`} · {new Date(m.match_date).toLocaleString('es-AR')}
                </div>
                <div className="teams">{m.home_team} vs {m.away_team}</div>
                {locked && (
                  <div style={{ fontSize: 12, color: 'var(--azul)' }}>
                    Resultado oficial: <b>{m.home_goals} - {m.away_goals}</b>
                  </div>
                )}
              </div>
              <input type="number" min="0" max="30"
                     value={home}
                     disabled={locked}
                     onChange={e => setDraft(m.id, 'home', e.target.value)} />
              <div style={{ textAlign: 'center', fontWeight: 700 }}>-</div>
              <input type="number" min="0" max="30"
                     value={away}
                     disabled={locked}
                     onChange={e => setDraft(m.id, 'away', e.target.value)} />
              {locked ? (
                <div className={`points ${ptsClass}`}>{pts} pts</div>
              ) : (
                <button className="btn-sm" disabled={saving === m.id} onClick={() => savePrediction(m)}>
                  {saving === m.id ? '...' : (pred ? 'Editar' : 'Guardar')}
                </button>
              )}

              {showAdmin && user?.is_admin && !locked && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'center', paddingTop: 8, borderTop: '1px dashed #ccc', marginTop: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--rojo)', fontWeight: 600 }}>⚙️ Cargar resultado oficial:</span>
                  <input type="number" min="0" max="30" style={{ width: 60 }} placeholder="L"
                         value={resultDraft[m.id]?.home ?? ''}
                         onChange={e => setResultDraft(d => ({ ...d, [m.id]: { ...d[m.id], home: e.target.value } }))} />
                  <span>-</span>
                  <input type="number" min="0" max="30" style={{ width: 60 }} placeholder="V"
                         value={resultDraft[m.id]?.away ?? ''}
                         onChange={e => setResultDraft(d => ({ ...d, [m.id]: { ...d[m.id], away: e.target.value } }))} />
                  <button className="btn-sm" style={{ background: 'var(--rojo)' }} onClick={() => saveResult(m)}>Guardar resultado</button>
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && <p style={{ textAlign: 'center', color: '#888' }}>No hay partidos con ese filtro.</p>}
      </div>
    </div>
  )
}

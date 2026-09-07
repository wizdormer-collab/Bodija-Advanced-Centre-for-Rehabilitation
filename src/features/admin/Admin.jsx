import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { scoreTriage } from '../../lib/scoring.js'
import {
  loadRules,
  getDefaultRules,
  saveRules,
  loadHistory,
  exportRulesJson,
  parseRulesText,
} from '../../lib/storage.js'

export default function Admin() {
  const navigate = useNavigate()
  const [rules, setRules] = useState(() => loadRules())
  const [saved, setSaved] = useState('')
  const [error, setError] = useState('')
  const [history, setHistory] = useState(() => loadHistory())
  const [session] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('bacr.session'))
    } catch {
      return null
    }
  })

  const changedBy = session?.name || 'admin'

  const setNested = (group, key, value) => {
    setSaved('')
    setRules((r) => ({ ...r, [group]: { ...r[group], [key]: Number(value) } }))
  }

  const setNextStep = (id, value) => {
    setSaved('')
    setRules((r) => ({ ...r, nextStepText: { ...r.nextStepText, [id]: value } }))
  }

  const save = () => {
    try {
      const savedRules = saveRules(rules, changedBy)
      setRules(savedRules)
      setHistory(loadHistory())
      setSaved('Rule changes saved and applied to all new submissions.')
      setError('')
    } catch (e) {
      setError(e.message || 'Could not save rules.')
    }
  }

  const exportJson = () => exportRulesJson(rules)

  const importFile = (file) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = parseRulesText(String(reader.result))
        setRules(parsed)
        setError('')
        setSaved('Rules imported. Click Save to version and apply.')
      } catch (e) {
        setError(e.message || 'Invalid rules file.')
      }
    }
    reader.readAsText(file)
  }

  const preview = (r) => {
    const base = { domains: ['speech'], riskFlags: [], redFlag: false }
    const cases = {
      'Red flag → REFER OUT': { ...base, redFlag: true },
      '1 domain, 0 risk → Single': { ...base },
      '2 domains → Dual': { ...base, domains: ['speech', 'mobility'] },
      '3+ domains → MDT': { ...base, domains: ['speech', 'mobility', 'cognition'] },
      '3+ risk → MDT': { ...base, riskFlags: ['stroke', 'cardiac', 'diabetes'] },
      'Risk 1–2 → Dual': { ...base, riskFlags: ['stroke'] },
    }
    return (
      <table className="preview-table">
        <thead>
          <tr>
            <th>Case</th>
            <th>Complexity</th>
            <th>Risk</th>
            <th>Pathway</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(cases).map(([label, input]) => {
            const out = scoreTriage(input, r)
            return (
              <tr key={label}>
                <td>{label}</td>
                <td>{out.complexity}</td>
                <td>{out.riskLevel}</td>
                <td>{out.pathwayLabel}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  return (
    <div className="admin">
      <div className="page-head">
        <h1>Routing rules</h1>
        <p className="muted">Changes take effect for new submissions immediately — no redeploy needed.</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {saved && <div className="alert alert-success">{saved}</div>}

      <div className="admin-tools">
        <label className="btn btn-ghost file-btn">
          Import JSON
          <input type="file" accept="application/json" onChange={(e) => e.target.files[0] && importFile(e.target.files[0])} />
        </label>
        <button className="btn btn-ghost" onClick={exportJson}>
          Export JSON
        </button>
        <button className="btn btn-ghost" onClick={() => setRules(getDefaultRules())}>
          Reset to defaults
        </button>
      </div>

      <div className="panel section">
        <h2>Thresholds</h2>
        <div className="grid-2">
          <div className="field">
            <span>Complexity — Moderate at {rules.complexityThresholds?.moderate} domain(s), Complex at {rules.complexityThresholds?.complex}</span>
          </div>
          <div className="field">
            <span>Risk — Moderate above low ({rules.riskThresholds?.low}), High at {rules.riskThresholds?.high}</span>
          </div>
        </div>
        <div className="grid-3">
          <label className="field">
            <span>Moderate from # domains</span>
            <input
              type="number"
              min="1"
              value={rules.complexityThresholds?.moderate ?? 2}
              onChange={(e) => setNested('complexityThresholds', 'moderate', e.target.value)}
            />
          </label>
          <label className="field">
            <span>Complex from # domains</span>
            <input
              type="number"
              min="1"
              value={rules.complexityThresholds?.complex ?? 3}
              onChange={(e) => setNested('complexityThresholds', 'complex', e.target.value)}
            />
          </label>
          <label className="field">
            <span>High risk from # flags</span>
            <input
              type="number"
              min="1"
              value={rules.riskThresholds?.high ?? 3}
              onChange={(e) => setNested('riskThresholds', 'high', e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="panel section">
        <h2>Next-step text per pathway</h2>
        <div className="grid-2">
          {Object.entries(rules.nextStepText || {}).map(([id, text]) => (
            <label key={id} className="field">
              <span>{id.replace(/_/g, ' ')}</span>
              <textarea value={text} onChange={(e) => setNextStep(id, e.target.value)} rows={2} />
            </label>
          ))}
        </div>
      </div>

      <div className="panel section">
        <h2>Live preview</h2>
        {preview(rules)}
      </div>

      <div className="form-actions">
        <button className="btn btn-ghost" onClick={() => navigate('/')}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={save}>
          Save & apply (v{typeof rules.version === 'number' ? rules.version + 1 : 1})
        </button>
      </div>

      <div className="panel section">
        <h2>Change history</h2>
        {history.length === 0 ? (
          <p className="muted">No changes recorded yet.</p>
        ) : (
          <table className="preview-table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Changed by</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.version}>
                  <td>v{h.version}</td>
                  <td>{h.updatedBy}</td>
                  <td>{new Date(h.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
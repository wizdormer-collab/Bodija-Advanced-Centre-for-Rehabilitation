import React, { useState } from 'react'
import { useNavigate, NavLink } from 'react-router-dom'
import { scoreTriage } from '../../lib/scoring.js'
import {
  loadRules,
  getDefaultRules,
  saveRules,
  loadHistory,
  exportRulesJson,
  parseRulesText,
} from '../../lib/storage.js'

function NumField({ label, value, min = 0, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="number" min={min} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

function TextAreaField({ label, value, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} />
    </label>
  )
}

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
  const v1 = rules.activeModel === 'v1'
  const cfg = v1 ? rules.v1 : rules.v2

  const patch = (partial) => setRules((r) => ({ ...r, [v1 ? 'v1' : 'v2']: { ...cfg, ...partial } }))
  const setActiveModel = (model) => {
    setSaved('')
    setRules((r) => ({ ...r, activeModel: model }))
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

  const previewV1 = (r) => {
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

  const previewV2 = (r) => {
    const painNone = { severity: 'none', worsening: false, recentInjury: false, neurological: false }
    const cases = {
      'PT only, no red flag': { problems: ['walking'], pain: painNone, acute: false },
      'OT only': { problems: ['dressing'], pain: painNone, acute: false },
      'Hearing only (AUD)': { problems: ['hearing_speech'], pain: painNone, acute: false },
      'OT + PT': { problems: ['walking', 'dressing'], pain: painNone, acute: false },
      'OT + SLT': { problems: ['dressing', 'speech'], pain: painNone, acute: false },
      'Stroke PT+OT+SLT': { problems: ['walking', 'dressing', 'speech'], pain: painNone, acute: false },
      'Severe pain + injury (H=3)': { problems: ['walking'], pain: { severity: 'severe', worsening: false, recentInjury: true, neurological: false }, acute: false },
      'Red flag A acute → urgent': { problems: ['walking'], redFlagAnswers: ['A'], pain: painNone, acute: true },
      'Red flag G (score 2)': { problems: ['walking'], redFlagAnswers: ['G'], pain: painNone, acute: false },
    }
    return (
      <table className="preview-table">
        <thead>
          <tr>
            <th>Case</th>
            <th>Disciplines</th>
            <th>Complexity</th>
            <th>Risk</th>
            <th>Pathway</th>
            <th>Fee</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(cases).map(([label, input]) => {
            const out = scoreTriage(input, r)
            return (
              <tr key={label}>
                <td>{label}</td>
                <td>{out.disciplinesLabels.length ? out.disciplinesLabels.join(' + ') : '—'}</td>
                <td>{out.complexity}</td>
                <td>{out.riskLevel}</td>
                <td>{out.pathwayLabel}</td>
                <td>{out.assessmentFeeLabel || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  const editRedFlag = (idx, patchObj) => {
    const list = (cfg.redFlags || []).map((f, i) => (i === idx ? { ...f, ...patchObj } : f))
    patch({ redFlags: list })
  }

  const editFeeTier = (idx, patchObj) => {
    const list = (cfg.feeTiers || []).map((t, i) => (i === idx ? { ...t, ...patchObj } : t))
    patch({ feeTiers: list })
  }

  const editBand = (key, patchObj) => {
    patch({ decisionBands: { ...cfg.decisionBands, [key]: { ...cfg.decisionBands[key], ...patchObj } } })
  }

  const editLevel = (key, patchObj) => {
    patch({ complexityLevels: { ...cfg.complexityLevels, [key]: { ...cfg.complexityLevels[key], ...patchObj } } })
  }

  return (
    <div className="admin">
      <div className="page-head">
        <nav className="nav page-tabs">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            New Triage
          </NavLink>
          <NavLink to="/admin" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            Routing Rules
          </NavLink>
        </nav>
        <h1>Routing rules</h1>
        <p className="muted">Changes take effect for new submissions immediately — no redeploy needed.</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {saved && <div className="alert alert-success">{saved}</div>}

      <div className="admin-tools">
        <div className="model-toggle">
          <span className="result-label">Active model</span>
          <button className={`btn ${!v1 ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveModel('v2')}>
            v2 — Discipline + weighted red flags (recommended)
          </button>
          <button className={`btn ${v1 ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveModel('v1')}>
            v1 — Count-based (legacy fallback)
          </button>
        </div>
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

      {v1 ? (
        <>
          <div className="panel section">
            <h2>Thresholds (v1)</h2>
            <div className="grid-3">
              <NumField label="Moderate from # domains" min={1} value={cfg.complexityThresholds?.moderate ?? 2} onChange={(n) => patch({ complexityThresholds: { ...cfg.complexityThresholds, moderate: n } })} />
              <NumField label="Complex from # domains" min={1} value={cfg.complexityThresholds?.complex ?? 3} onChange={(n) => patch({ complexityThresholds: { ...cfg.complexityThresholds, complex: n } })} />
              <NumField label="High risk from # flags" min={1} value={cfg.riskThresholds?.high ?? 3} onChange={(n) => patch({ riskThresholds: { ...cfg.riskThresholds, high: n } })} />
            </div>
          </div>

          <div className="panel section">
            <h2>Next-step text per pathway (v1)</h2>
            <div className="grid-2">
              {Object.entries(cfg.nextStepText || {}).map(([id, text]) => (
                <TextAreaField
                  key={id}
                  label={id.replace(/_/g, ' ')}
                  value={text}
                  onChange={(val) => patch({ nextStepText: { ...cfg.nextStepText, [id]: val } })}
                />
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="panel section">
            <h2>Assessment fees (₦)</h2>
            <p className="muted">Fee is discipline-neutral — based on number of required disciplines. OT is never secondary.</p>
            <div className="grid-3">
              {(cfg.feeTiers || []).map((tier, i) => (
                <div className="fee-tier" key={i}>
                  <NumField label="From # disciplines" min={1} value={tier.count} onChange={(n) => editFeeTier(i, { count: n })} />
                  <NumField label="Assessment fee (₦)" min={0} step={1000} value={tier.fee} onChange={(n) => editFeeTier(i, { fee: n })} />
                  <TextAreaField
                    label="Package label"
                    value={tier.package}
                    onChange={(val) => editFeeTier(i, { package: val })}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="panel section">
            <h2>Red-flag weights</h2>
            <p className="muted">Weighted score flags. Emergency flags (3-pt) trigger medical referral when acute.</p>
            {(cfg.redFlags || []).map((f, i) => (
              <div className="redflag-edit" key={f.id}>
                <div className="redflag-edit-title">
                  <strong>{f.label}</strong>
                </div>
                <div className="grid-3">
                  <NumField label="Score" min={0} value={f.score} onChange={(n) => editRedFlag(i, { score: n })} />
                  <label className="inline-check">
                    <input type="checkbox" checked={!!f.emergency} onChange={(e) => editRedFlag(i, { emergency: e.target.checked })} />
                    Emergency-type flag
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="panel section">
            <h2>Decision bands</h2>
            <div className="grid-3">
              {Object.entries(cfg.decisionBands || {}).map(([key, band]) => (
                <div className="band-edit" key={key}>
                  <h3 className="result-label">{key.replace(/_/g, ' ')}</h3>
                  <NumField label="Min score" min={0} value={band.minScore} onChange={(n) => editBand(key, { minScore: n })} />
                  <div className="grid-2">
                    <label className="field">
                      <span>Risk level</span>
                      <select value={band.riskLevel} onChange={(e) => editBand(key, { riskLevel: e.target.value })}>
                        {['Low', 'Moderate', 'High'].map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Requires acute</span>
                      <select value={band.requireAcute ? 'yes' : 'no'} onChange={(e) => editBand(key, { requireAcute: e.target.value === 'yes' })}>
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </label>
                  </div>
                  <TextAreaField label="Status text" value={band.statusText} onChange={(val) => editBand(key, { statusText: val })} />
                </div>
              ))}
            </div>
          </div>

          <div className="panel section">
            <h2>Complexity levels</h2>
            <p className="muted">Based on the number of required disciplines (1 / 2 / 3+).</p>
            <div className="grid-3">
              {Object.entries(cfg.complexityLevels || {}).map(([key, lvl]) => (
                <div className="band-edit" key={key}>
                  <h3 className="result-label">{key}</h3>
                  <NumField label="From # disciplines" min={1} value={lvl.count} onChange={(n) => editLevel(key, { count: n })} />
                  <TextAreaField label="Label" value={lvl.label} onChange={(val) => editLevel(key, { label: val })} />
                </div>
              ))}
            </div>
          </div>

          <div className="panel section">
            <h2>Outcome text per pathway (v2)</h2>
            <div className="grid-2">
              {Object.entries(cfg.outcomeText || {}).map(([id, text]) => (
                <TextAreaField key={id} label={id.replace(/_/g, ' ')} value={text} onChange={(val) => patch({ outcomeText: { ...cfg.outcomeText, [id]: val } })} />
              ))}
            </div>
          </div>
        </>
      )}

      <div className="panel section">
        <h2>Live preview — {v1 ? 'v1 model' : 'v2 model'}</h2>
        {v1 ? previewV1(rules) : previewV2(rules)}
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
                <th>Model</th>
                <th>Changed by</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.version}>
                  <td>v{h.version}</td>
                  <td>{h.activeModel || 'v1'}</td>
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
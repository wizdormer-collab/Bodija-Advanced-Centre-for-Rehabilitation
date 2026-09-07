import React, { useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { formatNaira } from '../../lib/scoring.js'
import { loadRules, loadSession, saveOverride } from '../../lib/storage.js'

const levelClass = (label) =>
  label === 'Low' || label === 'Simple' ? 'lvl-low' : label === 'High' || label === 'Complex' ? 'lvl-high' : 'lvl-moderate'

function V1Result({ patient, result }) {
  return (
    <div className="result-screen">
      <div className="result-head">
        <div className="result-block">
          <span className="result-label">Complexity</span>
          <span className={`result-value ${levelClass(result.complexity)}`}>{result.complexity}</span>
        </div>
        <div className="result-block">
          <span className="result-label">Risk level</span>
          <span className={`result-value ${levelClass(result.riskLevel)}`}>{result.riskLevel}</span>
        </div>
        <div className="result-block">
          <span className="result-label">Recommended pathway</span>
          <span className="result-value result-pathway">{result.pathwayLabel}</span>
        </div>
      </div>

      <div className="next-step">
        <h3>Suggested next step</h3>
        <p>{result.nextStep}</p>
      </div>

      <details className="details">
        <summary>How this was calculated</summary>
        <ul className="calc-list">
          <li>Domains selected: {result.domainsCount} → complexity {result.complexity}</li>
          <li>Risk flags: {result.riskScore} → risk {result.riskLevel}</li>
          <li>Red flag: {result.redFlag ? 'Yes (routes to REFER OUT)' : 'No'}</li>
          <li>Rule applied: {result.pathwayId}</li>
        </ul>
      </details>
    </div>
  )
}

function V2Result({ patient, result }) {
  const emergency = result.redFlagDecision === 'emergency'
  const pillClass =
    result.redFlagDecision === 'emergency' ? 'pill-red' : result.redFlagDecision === 'urgent_review' ? 'pill-orange' : 'pill-green'
  return (
    <div className="result-screen">
      {emergency && (
        <div className="emergency-banner">
          <h2>🔴 URGENT MEDICAL REFERRAL</h2>
          <p>Routine BACR rehabilitation assessment should not proceed until the patient has received appropriate medical assessment / clearance.</p>
        </div>
      )}

      <div className="v2-layout">
        <div className="hero-grid">
          <div className="hero-primary">
            <span className="result-label">Primary rehabilitation need</span>
            <span className="hero-value">{result.primaryDisciplineLabel || '—'}</span>
          </div>
          <div className="result-block">
            <span className="result-label">Complexity</span>
            <span className={`result-value ${levelClass(result.complexity)}`}>{result.complexity}</span>
          </div>
          <div className="result-block">
            <span className="result-label">Risk level</span>
            <span className={`result-value ${levelClass(result.riskLevel)}`}>{result.riskLevel}</span>
          </div>
        </div>

        <div className="sub-grid">
          <div className="result-block">
            <span className="result-label">Recommended pathway</span>
            <span className="result-value result-pathway">{result.pathwayLabel}</span>
          </div>
          <div className="result-block">
            <span className="result-label">Additional rehabilitation needs</span>
            <span className="result-value result-value-sm">
              {result.additionalDisciplinesLabels.length ? result.additionalDisciplinesLabels.join(' + ') : 'None'}
            </span>
          </div>
        </div>

        <div className={`redflag-pill ${pillClass}`}>{result.redFlagStatus}</div>

        <div className="fee-bar">
          <div>
            <span className="result-label">Proposed initial assessment fee</span>
            <span className="fee-amount">{emergency ? result.assessmentFeeLabel : formatNaira(result.fee)}</span>
          </div>
          <div>
            <span className="result-label">Assessment package</span>
            <span className="fee-package">{emergency ? 'Routine assessment not applied at triage' : result.feePackage}</span>
          </div>
          <div>
            <span className="result-label">Disciplines involved</span>
            <span className="fee-package">{result.disciplinesLabels.length ? result.disciplinesLabels.join(' + ') : '—'}</span>
          </div>
        </div>

        <div className="next-step">
          <h3>Suggested next step</h3>
          <p>{result.nextStep}</p>
        </div>

        <details className="details">
          <summary>How this was calculated</summary>
          <ul className="calc-list">
            <li>Disciplines mapped: {result.disciplinesLabels.length ? result.disciplinesLabels.join(' + ') : 'none'} ({result.disciplinesCount})</li>
            <li>Red-flag score: {result.redFlagScore} (incl. pain component {result.painScore}) → {result.redFlagDecision}</li>
            <li>Risk level: {result.riskLevel} · Assessment fee: {result.assessmentFeeLabel}</li>
            <li>Rule applied: {result.pathwayId}</li>
          </ul>
        </details>
      </div>
    </div>
  )
}

function OverridePanel({ patient, result }) {
  const cfg = loadRules().v2
  const session = loadSession()
  const canOverride = session && (session.role === 'coordinator' || session.role === 'admin')
  const [open, setOpen] = useState(false)
  const [decision, setDecision] = useState('confirm')
  const [disciplines, setDisciplines] = useState([])
  const [reason, setReason] = useState('')
  const [saved, setSaved] = useState(null)
  const [err, setErr] = useState('')

  if (!canOverride || result.model !== 'v2') return null

  const labels = cfg?.disciplineLabels || {}
  const order = cfg?.disciplineOrder || []

  const toggleDiscipline = (d) =>
    setDisciplines((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))

  const save = () => {
    if (!reason.trim() && decision !== 'confirm') {
      setErr('Please provide a reason for the override.')
      return
    }
    setErr('')
    const entry = {
      patientName: patient.patientName,
      patientRef: patient.patientRef,
      patientDob: patient.patientDob,
      createdAt: new Date().toISOString(),
      by: session?.name || session?.role || 'unknown',
      systemRecommendation: {
        pathway: result.pathwayLabel,
        disciplines: result.disciplinesLabels,
        fee: result.assessmentFeeLabel,
      },
      decision,
      disciplines: decision === 'change' ? disciplines.map((d) => labels[d] || d) : [],
      reason: reason.trim(),
    }
    saveOverride(entry)
    setSaved(entry)
  }

  if (saved) {
    return (
      <div className="panel section override-panel">
        <h2>Coordinator override — recorded</h2>
        <div className="override-record">
          <p>
            <strong>System recommendation:</strong> {saved.systemRecommendation.pathway}
            {saved.systemRecommendation.disciplines.length ? ` (${saved.systemRecommendation.disciplines.join(' + ')})` : ''} ·{' '}
            {saved.systemRecommendation.fee}
          </p>
          <p>
            <strong>Coordinator decision:</strong> {saved.decision}
            {saved.disciplines.length ? ` — ${saved.disciplines.join(' + ')}` : ''}
          </p>
          {saved.reason && (
            <p>
              <strong>Reason:</strong> {saved.reason}
            </p>
          )}
          <p className="muted">
            Recorded by {saved.by} on {new Date(saved.createdAt).toLocaleString()}. Automatically included in the print-out.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="panel section override-panel">
      <h2>Clinical case coordinator</h2>
      <p className="muted">Optional clinical override. The system recommendation is recorded alongside your decision.</p>
      {!open ? (
        <button className="btn btn-ghost" onClick={() => setOpen(true)}>
          Review routing
        </button>
      ) : (
        <div className="form">
          <label className="field">
            <span>Coordinator decision</span>
            <select value={decision} onChange={(e) => setDecision(e.target.value)}>
              <option value="confirm">Confirm as recommended</option>
              <option value="change">Change disciplines</option>
              <option value="medical">Refer for medical review (urgent)</option>
              <option value="outside">Outside BACR scope</option>
            </select>
          </label>

          {decision === 'change' && (
            <div className="chip-grid">
              {order.map((d) => (
                <button
                  type="button"
                  key={d}
                  className={`chip ${disciplines.includes(d) ? 'chip-on' : ''}`}
                  onClick={() => toggleDiscipline(d)}
                >
                  {labels[d] || d}
                </button>
              ))}
            </div>
          )}

          <label className="field">
            <span>{decision === 'confirm' ? 'Notes (optional)' : 'Reason for override *'}</span>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </label>

          {err && <div className="alert alert-error">{err}</div>}

          <div className="form-actions">
            <button className="btn btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={save}>
              Record decision
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function PatientSummary({ patient }) {
  return (
    <p className="muted">
      For: <strong>{patient.patientName}</strong>
      {patient.patientRef ? ` · Ref ${patient.patientRef}` : ''}
      {patient.patientDob ? ` · DOB ${patient.patientDob}` : ''} · Model:{' '}
      <strong>{patient.model === 'v1' ? 'count-based' : 'discipline + weighted red-flag'}</strong>
    </p>
  )
}

export default function Result() {
  const location = useLocation()
  const navigate = useNavigate()
  const { patient, result } = location.state || {}
  if (!result || !patient) {
    return (
      <div className="panel">
        <p>No triage result found. Please complete a new triage.</p>
        <Link to="/" className="btn btn-primary">
          New triage
        </Link>
      </div>
    )
  }

  return (
    <div className="result">
      <div className="page-head">
        <h1>BACR Triage Result</h1>
        <PatientSummary patient={patient} />
      </div>

      {result.model === 'v1' ? <V1Result patient={patient} result={result} /> : <V2Result patient={patient} result={result} />}

      <OverridePanel patient={patient} result={result} />

      <div className="form-actions">
        <Link to="/" className="btn btn-ghost">
          New triage
        </Link>
        <button className="btn btn-primary" onClick={() => window.print()}>
          Print result
        </button>
      </div>
    </div>
  )
}
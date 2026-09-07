import React from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'

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

  const levelClass = (label) =>
    label === 'Low' || label === 'Simple' ? 'lvl-low' : label === 'High' || label === 'Complex' ? 'lvl-high' : 'lvl-moderate'

  return (
    <div className="result">
      <div className="page-head">
        <h1>Result</h1>
        <p className="muted">
          For: <strong>{patient.patientName}</strong>
          {patient.patientRef ? ` · Ref ${patient.patientRef}` : ''}
        </p>
      </div>

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
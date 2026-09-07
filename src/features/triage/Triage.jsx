import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DOMAIN_OPTIONS, RISK_FLAG_OPTIONS, scoreTriage } from '../../lib/scoring.js'
import { loadRules } from '../../lib/storage.js'

const emptyForm = {
  patientName: '',
  patientDob: '',
  patientRef: '',
  domains: [],
  riskFlags: [],
  redFlag: '',
}

export default function Triage() {
  const navigate = useNavigate()
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const toggleList = (key, id) => {
    const current = form[key]
    set({ [key]: current.includes(id) ? current.filter((x) => x !== id) : [...current, id] })
  }

  const submit = (e) => {
    e.preventDefault()
    if (!form.patientName.trim()) {
      setError('Patient name is required.')
      return
    }
    if (form.domains.length === 0) {
      setError('Select at least one functional domain.')
      return
    }
    if (form.redFlag === '') {
      setError('Select Yes or No for the red-flag question.')
      return
    }
    setError('')
    const rules = loadRules()
    const result = scoreTriage(
      {
        domains: form.domains,
        riskFlags: form.riskFlags,
        redFlag: form.redFlag === 'yes',
      },
      rules,
    )
    navigate('/result', {
      state: { patient: { ...form, redFlag: form.redFlag === 'yes' }, result },
    })
  }

  return (
    <div className="triage">
      <div className="page-head">
        <h1>New Patient Triage</h1>
        <p className="muted">Complete the intake below. Results are calculated instantly.</p>
      </div>

      <form onSubmit={submit} className="form panel">
        <section className="section">
          <h2>Patient identification</h2>
          <div className="grid-3">
            <label className="field">
              <span>Patient name *</span>
              <input value={form.patientName} onChange={(e) => set({ patientName: e.target.value })} />
            </label>
            <label className="field">
              <span>Date of birth</span>
              <input type="date" value={form.patientDob} onChange={(e) => set({ patientDob: e.target.value })} />
            </label>
            <label className="field">
              <span>File / reference number</span>
              <input value={form.patientRef} onChange={(e) => set({ patientRef: e.target.value })} />
            </label>
          </div>
        </section>

        <section className="section">
          <h2>A. Functional domains</h2>
          <p className="muted">Select all that apply.</p>
          <div className="chip-grid">
            {DOMAIN_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt.id}
                className={`chip ${form.domains.includes(opt.id) ? 'chip-on' : ''}`}
                onClick={() => toggleList('domains', opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        <section className="section">
          <h2>B. Risk flags</h2>
          <p className="muted">Select all that apply.</p>
          <div className="chip-grid">
            {RISK_FLAG_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt.id}
                className={`chip ${form.riskFlags.includes(opt.id) ? 'chip-on' : ''}`}
                onClick={() => toggleList('riskFlags', opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        <section className="section">
          <h2>C. Red flag</h2>
          <p className="muted">Is there an unstable condition requiring immediate referral?</p>
          <div className="inline-field">
            {['no', 'yes'].map((val) => (
              <label key={val} className={`redchoice ${form.redFlag === val ? 'redchoice-on' : ''}`}>
                <input
                  type="radio"
                  name="redFlag"
                  value={val}
                  checked={form.redFlag === val}
                  onChange={() => set({ redFlag: val })}
                />
                {val === 'yes' ? 'Yes — unstable, immediate referral' : 'No'}
              </label>
            ))}
          </div>
        </section>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setForm(emptyForm)}>
            Reset
          </button>
          <button type="submit" className="btn btn-primary">
            Calculate result
          </button>
        </div>
      </form>
    </div>
  )
}
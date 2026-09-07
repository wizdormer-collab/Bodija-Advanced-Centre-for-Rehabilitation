import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DOMAIN_OPTIONS,
  RISK_FLAG_OPTIONS,
  PAIN_SEVERITY_OPTIONS,
  scoreTriage,
  isV1Rules,
} from '../../lib/scoring.js'
import { loadRules } from '../../lib/storage.js'

const emptyForm = {
  patientName: '',
  patientDob: '',
  patientRef: '',
  domains: [],
  riskFlags: [],
  redFlag: '',
  problems: [],
  redFlagAnswers: [],
  pain: { severity: '', worsening: false, recentInjury: false, neurological: false },
  acute: '',
  clinicianUnstable: false,
}

export default function Triage() {
  const navigate = useNavigate()
  const [rules] = useState(() => loadRules())
  const v1 = isV1Rules(rules)
  const cfg = v1 ? rules.v1 : rules.v2
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const toggleList = (key, id) => {
    const current = form[key]
    set({ [key]: current.includes(id) ? current.filter((x) => x !== id) : [...current, id] })
  }

  const setPain = (patch) => set({ pain: { ...form.pain, ...patch } })

  const submit = (e) => {
    e.preventDefault()
    if (!form.patientName.trim()) {
      setError('Patient name is required.')
      return
    }
    if (v1) {
      if (form.domains.length === 0) {
        setError('Select at least one functional domain.')
        return
      }
      if (form.redFlag === '') {
        setError('Select Yes or No for the red-flag question.')
        return
      }
    } else {
      if (form.problems.length === 0) {
        setError('Select at least one functional problem.')
        return
      }
      if (form.pain.severity === '') {
        setError('Select the pain severity option (use "None / mild" if no pain).')
        return
      }
      if (form.acute === '') {
        setError('Select whether the presentation is current / acute.')
        return
      }
    }
    setError('')

    const input = v1
      ? {
          domains: form.domains,
          riskFlags: form.riskFlags,
          redFlag: form.redFlag === 'yes',
        }
      : {
          problems: form.problems,
          redFlagAnswers: form.redFlagAnswers,
          pain: form.pain,
          acute: form.acute === 'yes',
          clinicianUnstable: form.clinicianUnstable,
        }

    const result = scoreTriage(input, rules)
    navigate('/result', {
      state: { patient: { ...form, model: v1 ? 'v1' : 'v2' }, result },
    })
  }

  const triggerGroups = Object.entries(cfg?.disciplineTriggers || {})
  const redFlagList = cfg?.redFlags || []

  return (
    <div className="triage">
      <div className="page-head">
        <h1>New Patient Triage</h1>
        <p className="muted">
          {v1 ? 'Original count-based model' : 'Discipline + weighted red-flag model'} · Results are calculated instantly.
        </p>
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
              <input
                type="date"
                value={form.patientDob}
                onChange={(e) => set({ patientDob: e.target.value })}
              />
            </label>
            <label className="field">
              <span>File / reference number</span>
              <input value={form.patientRef} onChange={(e) => set({ patientRef: e.target.value })} />
            </label>
          </div>
        </section>

        {v1 ? (
          <>
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
                  <label
                    key={val}
                    className={`redchoice ${form.redFlag === val ? 'redchoice-on' : ''}`}
                  >
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
          </>
        ) : (
          <>
            <section className="section">
              <h2>A. Functional problems</h2>
              <p className="muted">Select all that apply. Pathways are derived from these — grouped by potential discipline.</p>
              {triggerGroups.map(([disc, triggers]) => (
                <fieldset key={disc} className="problem-group">
                  <legend className="problem-legend">{cfg.disciplineLabels?.[disc] || disc}</legend>
                  <div className="chip-grid">
                    {triggers.map((t) => (
                      <button
                        type="button"
                        key={t.id}
                        className={`chip ${form.problems.includes(t.id) ? 'chip-on' : ''}`}
                        onClick={() => toggleList('problems', t.id)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ))}
            </section>

            <section className="section">
              <h2>B. Pain</h2>
              <p className="muted">Pain can contribute to red-flag scoring when severe or rapidly worsening.</p>
              <div className="grid-2">
                <label className="field">
                  <span>Pain severity</span>
                  <select value={form.pain.severity} onChange={(e) => setPain({ severity: e.target.value })}>
                    <option value="">Select…</option>
                    {PAIN_SEVERITY_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={form.pain.worsening}
                    onChange={(e) => setPain({ worsening: e.target.checked })}
                  />
                  Pain is rapidly worsening
                </label>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={form.pain.recentInjury}
                    onChange={(e) => setPain({ recentInjury: e.target.checked })}
                  />
                  Recent injury involved
                </label>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={form.pain.neurological}
                    onChange={(e) => setPain({ neurological: e.target.checked })}
                  />
                  Neurological symptoms present
                </label>
              </div>
            </section>

            <section className="section">
              <h2>C. Red-flag screen</h2>
              <p className="muted">Select all that apply.</p>
              <div className="redflag-list">
                {redFlagList.map((f) => (
                  <label key={f.id} className={`redchoice ${form.redFlagAnswers.includes(f.id) ? 'redchoice-on' : ''}`}>
                    <input
                      type="checkbox"
                      checked={form.redFlagAnswers.includes(f.id)}
                      onChange={() => toggleList('redFlagAnswers', f.id)}
                    />
                    <span className="redflag-title">{f.label}</span>
                    <span className="muted">{f.question}</span>
                  </label>
                ))}
              </div>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={form.clinicianUnstable}
                  onChange={(e) => set({ clinicianUnstable: e.target.checked })}
                />
                Clinician judgement — patient appears medically unstable
              </label>
            </section>

            <section className="section">
              <h2>D. Acuteness</h2>
              <p className="muted">Is the presentation current / acute (developed recently, in days)?</p>
              <div className="inline-field">
                {['no', 'yes'].map((val) => (
                  <label key={val} className={`redchoice ${form.acute === val ? 'redchoice-on' : ''}`}>
                    <input
                      type="radio"
                      name="acute"
                      value={val}
                      checked={form.acute === val}
                      onChange={() => set({ acute: val })}
                    />
                    {val === 'yes' ? 'Yes — current / acute' : 'No — not acute'}
                  </label>
                ))}
              </div>
            </section>
          </>
        )}

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
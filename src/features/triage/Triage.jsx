import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DOMAIN_OPTIONS,
  RISK_FLAG_OPTIONS,
  PAIN_SEVERITY_OPTIONS,
  scoreTriage,
  previewV2,
  formatNaira,
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

function StepTitle({ n, children, note }) {
  return (
    <div className="step-title">
      <span className="step-num">{n}</span>
      <div>
        <h2>{children}</h2>
        {note && <p className="muted step-note">{note}</p>}
      </div>
    </div>
  )
}

export default function Triage() {
  const navigate = useNavigate()
  const [rules] = useState(() => loadRules())
  const v1 = isV1Rules(rules)
  const cfg = v1 ? rules.v1 : rules.v2
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [openGroup, setOpenGroup] = useState('PT')

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
  const live = previewV2(form.problems, rules)
  const groupCount = (disc) => cfg?.disciplineTriggers?.[disc]?.filter((t) => form.problems.includes(t.id)).length || 0

  return (
    <div className="triage">
      <div className="page-head">
        <p className="muted">
          {v1 ? 'Original count-based model' : 'Discipline + weighted red-flag model'} · Results are calculated instantly.
        </p>
      </div>

      {!v1 && (
        <div className="triage-summary">
          <span className="triage-summary-label">Mapped so far</span>
          <span className="summary-mapped">
            {live.disciplinesLabels.length ? (
              live.disciplines.map((d, i) => (
                <span key={d} className={`summary-chip ${i === 0 ? 'primary-chip' : ''}`}>
                  {live.disciplinesLabels[i]}
                </span>
              ))
            ) : (
              <em className="summary-none">Select functional problems</em>
            )}
          </span>
          <span className="summary-meta">
            {live.disciplinesLabels.length
              ? `Complexity: ${live.complexity} · Est. fee: ${formatNaira(live.fee)}`
              : ''}
          </span>
        </div>
      )}

      <form onSubmit={submit} className="form panel">
        <section className="section">
          <StepTitle n={1}>Patient identification</StepTitle>
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
              <StepTitle n={2}>Functional domains</StepTitle>
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
              <StepTitle n={3}>Risk flags</StepTitle>
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
              <StepTitle n={4}>Red flag</StepTitle>
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
          </>
        ) : (
          <>
            <section className="section">
              <StepTitle n={2} note="Select all that apply. Pathways are derived from these — tap a group to expand it.">
                Functional problems
              </StepTitle>
              <div className="problem-accordion">
                {triggerGroups.map(([disc, triggers]) => {
                  const open = openGroup === disc
                  const count = groupCount(disc)
                  return (
                    <div key={disc} className={`problem-group ${open ? 'open' : ''}`}>
                      <button type="button" className="group-head" onClick={() => setOpenGroup(open ? '' : disc)}>
                        <span className="group-name">{cfg.disciplineLabels?.[disc] || disc}</span>
                        {count > 0 && <span className="group-count">{count}</span>}
                        <span className={`chevron ${open ? 'rotate' : ''}`} aria-hidden="true">
                          ▾
                        </span>
                      </button>
                      {open && (
                        <div className="group-body">
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
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="section">
              <StepTitle n={3} note="Pain can contribute to red-flag scoring when severe or rapidly worsening.">
                Pain &amp; red-flag screen
              </StepTitle>
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
              <div className="redflag-list">
                {redFlagList.map((f) => (
                  <label key={f.id} className={`redchoice ${form.redFlagAnswers.includes(f.id) ? 'redchoice-on' : ''}`}>
                    <input
                      type="checkbox"
                      checked={form.redFlagAnswers.includes(f.id)}
                      onChange={() => toggleList('redFlagAnswers', f.id)}
                    />
                    <div>
                      <span className="redflag-title">{f.label}</span>
                      <span className="muted redflag-q">{f.question}</span>
                      <span className="redflag-score">+{f.score}</span>
                    </div>
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
              <StepTitle n={4} note="Is the presentation current / acute (developed recently, in days)?">
                Acuteness
              </StepTitle>
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
          <button type="submit" className="btn btn-primary btn-lg">
            Calculate result
          </button>
        </div>
      </form>
    </div>
  )
}
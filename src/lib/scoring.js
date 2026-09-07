import DEFAULT_RULES from './defaultRules.json'

export const DOMAIN_OPTIONS = [
  { id: 'speech', label: 'Speech / Communication' },
  { id: 'mobility', label: 'Mobility / Movement' },
  { id: 'adl', label: 'Functional / ADL' },
  { id: 'hearing', label: 'Hearing' },
  { id: 'cognition', label: 'Cognition' },
]

export const RISK_FLAG_OPTIONS = [
  { id: 'stroke', label: 'Recent stroke' },
  { id: 'cardiac', label: 'Cardiac condition' },
  { id: 'hypertension', label: 'Hypertension' },
  { id: 'diabetes', label: 'Diabetes' },
  { id: 'recent_surgery', label: 'Recent surgery' },
  { id: 'severe_pain', label: 'Severe pain' },
  { id: 'dizziness', label: 'Dizziness' },
]

export const PAIN_SEVERITY_OPTIONS = [
  { id: 'none', label: 'None / mild' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'severe', label: 'Severe' },
  { id: 'very_severe', label: 'Very severe' },
]

const OPS = {
  '=': (a, b) => a === b,
  '>': (a, b) => a > b,
  '>=': (a, b) => a >= b,
  '<': (a, b) => a < b,
  '<=': (a, b) => a <= b,
}

function satisfyCondition(condition, v) {
  if (!condition || !(condition.field in v)) return false
  let expected = condition.value
  if (condition.field === 'red_flag') expected = !!expected
  if (condition.op === 'between') {
    return v[condition.field] >= condition.min && v[condition.field] <= condition.max
  }
  if (condition.op === 'in') {
    return Array.isArray(expected) && expected.includes(v[condition.field])
  }
  return OPS[condition.op] ? OPS[condition.op](v[condition.field], expected) : false
}

function clauseMatches(clause, v) {
  if (!Array.isArray(clause) || clause.length === 0) return false
  return clause.every((c) => satisfyCondition(c, v))
}

function ruleMatches(rule, v) {
  if (rule.else) return true
  if (!Array.isArray(rule.or) || rule.or.length === 0) return false
  return rule.or.some((clause) => clauseMatches(clause, v))
}

export function classifyComplexity(count, thresholds) {
  if (count >= thresholds.complex) return 'Complex'
  if (count >= thresholds.moderate) return 'Moderate'
  return 'Simple'
}

export function classifyRisk(score, thresholds) {
  if (score >= thresholds.high) return 'High'
  if (score > thresholds.low) return 'Moderate'
  return 'Low'
}

export function evaluatePathway(v, pathwayRules) {
  const ordered = (pathwayRules || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  for (const rule of ordered) {
    if (ruleMatches(rule, v)) return rule
  }
  return ordered[ordered.length - 1] || { id: 'no_match', label: 'NO MATCH' }
}

/* ---------------------------------- V1 ---------------------------------- */
/* Original count-based model (kept as fallback behind activeModel = 'v1').  */

function v1ToFields(input) {
  return {
    domains_count: Array.isArray(input.domains) ? input.domains.length : 0,
    risk_score: Array.isArray(input.riskFlags) ? input.riskFlags.length : 0,
    red_flag: !!input.redFlag,
  }
}

export function scoreV1(input, rules = DEFAULT_RULES) {
  const cfg = rules.v1 || rules
  const v = v1ToFields(input)
  const complexity = classifyComplexity(v.domains_count, cfg.complexityThresholds)
  const riskLevel = classifyRisk(v.risk_score, cfg.riskThresholds)
  const pathway = evaluatePathway(v, cfg.pathwayRules)
  const nextStep =
    (cfg.nextStepText && (cfg.nextStepText[pathway.id] || cfg.nextStepText[pathway.label])) || ''
  return {
    model: 'v1',
    domainsCount: v.domains_count,
    riskScore: v.risk_score,
    redFlag: v.red_flag,
    complexity,
    riskLevel,
    pathwayId: pathway.id,
    pathwayLabel: pathway.label,
    nextStep,
  }
}

/* ---------------------------------- V2 ---------------------------------- */
/* Discipline + weighted red-flag model from the "Triage form brief".        */

function disciplineTriggers(cfg) {
  const map = {}
  for (const [disc, triggers] of Object.entries(cfg.disciplineTriggers || {})) {
    map[disc] = triggers.map((t) => t.id)
  }
  return map
}

function mapDisciplines(problems, cfg) {
  const triggers = disciplineTriggers(cfg)
  const order = cfg.disciplineOrder || ['PT', 'OT', 'SLT', 'AUD', 'BT', 'PSY']
  const selected = new Set(Array.isArray(problems) ? problems : [])
  return order.filter((disc) => (triggers[disc] || []).some((id) => selected.has(id)))
}

function painScore(input, cfg) {
  const h = cfg.painHRules || {}
  const severity = input.pain?.severity
  const severe = severity === 'severe' || severity === 'very_severe'
  const worsening = !!input.pain?.worsening
  const recentInjury = !!input.pain?.recentInjury
  const neurologic = !!input.pain?.neurological
  if (severe && recentInjury) return h.severePlusInjuryScore ?? 3
  if (severe && neurologic) return h.severePlusNeurologicScore ?? 3
  if (severe) return h.severeTierScore ?? 2
  if (worsening) return h.worseningScore ?? 2
  return 0
}

function redFlagDecision(input, totalScore, cfg, flags) {
  const bands = cfg.decisionBands || {}
  const acute = !!input.acute
  if (input.clinicianUnstable) return 'emergency'
  const emg = bands.emergency
  const hasEmergencyFlag = flags.singleEmergency || flags.painEmergency
  if (acute && (hasEmergencyFlag || totalScore >= (emg && emg.minScore))) return 'emergency'
  const urg = bands.urgent_review || { minScore: 2 }
  if (totalScore >= (urg.minScore ?? 2)) return 'urgent_review'
  return 'green'
}

export function scoreV2(input, rules = DEFAULT_RULES) {
  const cfg = rules.v2 || rules
  const disciplines = mapDisciplines(input.problems, cfg)
  const disciplinesCount = disciplines.length

  const redFlags = cfg.redFlags || []
  let redFlagScore = 0
  let painEmergency = false
  let singleEmergency = false
  for (const flag of redFlags) {
    if (Array.isArray(input.redFlagAnswers) && input.redFlagAnswers.includes(flag.id)) {
      redFlagScore += flag.score
      if (flag.emergency) singleEmergency = true
    }
  }
  const pain = painScore(input, cfg)
  redFlagScore += pain
  if (pain >= 3) painEmergency = true

  const decision = redFlagDecision(input, redFlagScore, cfg, { painEmergency, singleEmergency })
  const bands = cfg.decisionBands || {}
  const band = bands[decision] || bands.green || {}

  const levels = cfg.complexityLevels || {}
  const levelKey = disciplinesCount >= (levels.mdt?.count ?? 3) ? 'mdt' : disciplinesCount === (levels.dual?.count ?? 2) ? 'dual' : disciplinesCount === (levels.single?.count ?? 1) ? 'single' : null
  const complexity = levelKey ? levels[levelKey].label : '—'

  const tiers = (cfg.feeTiers || []).slice().sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
  let fee = null
  let feePackage = ''
  if (disciplinesCount > 0 && decision !== 'emergency') {
    const tier = tiers.find((t) => disciplinesCount >= t.count) || tiers[tiers.length - 1]
    if (tier) {
      fee = tier.fee
      feePackage = tier.package
    }
  }

  const pathway = evaluatePathway(
    { disciplines_count: disciplinesCount, red_flag_score: redFlagScore, red_flag_decision: decision },
    cfg.pathwayRules,
  )
  const nextStep =
    (cfg.outcomeText && (cfg.outcomeText[pathway.id] || cfg.outcomeText[pathway.label] || cfg.outcomeText.manual_review)) || ''

  const labels = cfg.disciplineLabels || {}
  return {
    model: 'v2',
    disciplines,
    disciplinesCount,
    disciplinesLabels: disciplines.map((d) => labels[d] || d),
    primaryDiscipline: disciplines[0] || null,
    primaryDisciplineLabel: disciplines[0] ? labels[disciplines[0]] || disciplines[0] : null,
    additionalDisciplines: disciplines.slice(1),
    additionalDisciplinesLabels: disciplines.slice(1).map((d) => labels[d] || d),
    redFlagScore,
    painScore: pain,
    redFlagDecision: decision,
    redFlagStatus: band.statusText || band.label || decision,
    riskLevel: band.riskLevel || 'Low',
    complexity,
    pathwayId: pathway.id,
    pathwayLabel: pathway.label,
    nextStep,
    fee,
    feePackage,
    assessmentFeeLabel:
      decision === 'emergency' ? 'Not applicable at this stage' : fee === null ? 'Not applicable' : formatNaira(fee),
  }
}

export function formatNaira(amount) {
  if (amount === null || amount === undefined) return ''
  return '₦' + Number(amount).toLocaleString('en-NG')
}

/* ------------------------------ Dispatcher ------------------------------ */

export function scoreTriage(input, rules = DEFAULT_RULES) {
  if (rules && rules.activeModel === 'v1') return scoreV1(input, rules)
  return scoreV2(input, rules)
}

export function previewV2(problems, rules = DEFAULT_RULES) {
  const cfg = rules?.v2 || rules || DEFAULT_RULES.v2
  const out = scoreV2(
    { problems, pain: { severity: 'none', worsening: false, recentInjury: false, neurological: false }, acute: false },
    { ...DEFAULT_RULES, v2: cfg, activeModel: 'v2' },
  )
  return {
    disciplines: out.disciplines,
    disciplinesLabels: out.disciplinesLabels,
    complexity: out.complexity,
    fee: out.fee,
    feeLabel: out.assessmentFeeLabel,
  }
}

export function isV1Rules(rules) {
  return !!(rules && rules.activeModel === 'v1')
}

export function isV2Rules(rules) {
  return !!(rules && rules.activeModel === 'v2')
}
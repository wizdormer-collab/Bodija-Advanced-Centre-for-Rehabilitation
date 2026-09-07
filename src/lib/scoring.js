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

function toV1(input) {
  return {
    domains_count: Array.isArray(input.domains) ? input.domains.length : 0,
    risk_score: Array.isArray(input.riskFlags) ? input.riskFlags.length : 0,
    red_flag: !!input.redFlag,
  }
}

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

export function scoreTriage(input, rules = DEFAULT_RULES) {
  const v = toV1(input)
  const complexity = classifyComplexity(v.domains_count, rules.complexityThresholds)
  const riskLevel = classifyRisk(v.risk_score, rules.riskThresholds)
  const pathway = evaluatePathway(v, rules.pathwayRules)
  const nextStep =
    (rules.nextStepText &&
      (rules.nextStepText[pathway.id] || rules.nextStepText[pathway.label])) ||
    ''
  return {
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
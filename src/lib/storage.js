import DEFAULT_RULES from './defaultRules.json'
import { scoreTriage } from './scoring.js'

export const RULES_KEY = 'bacr.rules'
export const HISTORY_KEY = 'bacr.rulesHistory'
export const SESSION_KEY = 'bacr.session'
export const OVERRIDES_KEY = 'bacr.overrides'

export function getDefaultRules() {
  return DEFAULT_RULES
}

export function loadRules() {
  try {
    const raw = localStorage.getItem(RULES_KEY)
    if (!raw) return DEFAULT_RULES
    const parsed = JSON.parse(raw)
    if (parsed.v1 && parsed.v2) return parsed
    if (parsed.complexityThresholds || parsed.pathwayRules) {
      return { ...DEFAULT_RULES, version: parsed.version, activeModel: 'v1', v1: parsed, updatedAt: parsed.updatedAt, updatedBy: parsed.updatedBy }
    }
    return parsed
  } catch (e) {
    /* ignore corrupted storage */
  }
  return DEFAULT_RULES
}

export function nextVersion(rules) {
  return typeof rules.version === 'number' ? rules.version + 1 : 1
}

export function saveRules(rules, changedBy) {
  const entry = {
    ...rules,
    version: nextVersion(rules),
    updatedAt: new Date().toISOString(),
    updatedBy: changedBy || 'unknown',
  }
  localStorage.setItem(RULES_KEY, JSON.stringify(entry))
  const history = loadHistory()
  history.unshift(entry)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20)))
  return entry
}

export function clearRules() {
  localStorage.removeItem(RULES_KEY)
}

export function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    /* ignore */
  }
  return []
}

function validateV1(v1) {
  if (!v1 || typeof v1 !== 'object') throw new Error('v1 rules must be an object.')
  if (!v1.complexityThresholds || typeof v1.complexityThresholds.moderate !== 'number') {
    throw new Error('v1.complexityThresholds.moderate must be a number.')
  }
  if (!v1.riskThresholds || typeof v1.riskThresholds.high !== 'number') {
    throw new Error('v1.riskThresholds.high must be a number.')
  }
  if (!Array.isArray(v1.pathwayRules) || v1.pathwayRules.length === 0) {
    throw new Error('v1.pathwayRules must be a non-empty list.')
  }
}

function validateV2(v2) {
  if (!v2 || typeof v2 !== 'object') throw new Error('v2 rules must be an object.')
  if (!Array.isArray(v2.disciplineOrder) || v2.disciplineOrder.length === 0) {
    throw new Error('v2.disciplineOrder must be a non-empty list.')
  }
  if (!v2.disciplineTriggers || typeof v2.disciplineTriggers !== 'object') {
    throw new Error('v2.disciplineTriggers must be an object.')
  }
  if (!Array.isArray(v2.redFlags) || v2.redFlags.length === 0) {
    throw new Error('v2.redFlags must be a non-empty list.')
  }
  if (!v2.decisionBands || !v2.decisionBands.emergency) {
    throw new Error('v2.decisionBands.emergency must be defined.')
  }
  if (!Array.isArray(v2.feeTiers) || v2.feeTiers.length === 0) {
    throw new Error('v2.feeTiers must be a non-empty list.')
  }
}

export function validateRules(rules) {
  if (!rules || typeof rules !== 'object') throw new Error('Rules must be a JSON object.')

  if (rules.activeModel === 'v1') {
    validateV1(rules.v1 || rules)
    scoreTriage({ domains: ['speech'], riskFlags: [], redFlag: false }, rules)
    scoreTriage({ domains: ['speech'], riskFlags: ['stroke'], redFlag: true }, rules)
  } else {
    validateV2(rules.v2 || rules)
    scoreTriage({ problems: ['walking'] }, rules)
    scoreTriage({ problems: ['dressing'], redFlagAnswers: ['A'], acute: true }, rules)
  }
  return true
}

export function parseRulesText(text) {
  const parsed = JSON.parse(text)
  validateRules(parsed)
  return parsed
}

export function exportRulesJson(rules) {
  const blob = new Blob([JSON.stringify(rules, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `bacr-rules-v${rules.version || '1'}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    /* ignore */
  }
  return null
}

export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

export function loadOverrides() {
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    /* ignore */
  }
  return []
}

export function saveOverride(entry) {
  const list = loadOverrides()
  list.unshift(entry)
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(list.slice(0, 100)))
  return entry
}
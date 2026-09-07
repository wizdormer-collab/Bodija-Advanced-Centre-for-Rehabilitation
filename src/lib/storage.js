import DEFAULT_RULES from './defaultRules.json'
import { scoreTriage } from './scoring.js'

export const RULES_KEY = 'bacr.rules'
export const HISTORY_KEY = 'bacr.rulesHistory'
export const SESSION_KEY = 'bacr.session'

export function getDefaultRules() {
  return DEFAULT_RULES
}

export function loadRules() {
  try {
    const raw = localStorage.getItem(RULES_KEY)
    if (raw) return JSON.parse(raw)
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

export function validateRules(rules) {
  if (!rules || typeof rules !== 'object') throw new Error('Rules must be a JSON object.')
  if (!rules.complexityThresholds || typeof rules.complexityThresholds.moderate !== 'number') {
    throw new Error('complexityThresholds.moderate must be a number.')
  }
  if (!rules.riskThresholds || typeof rules.riskThresholds.high !== 'number') {
    throw new Error('riskThresholds.high must be a number.')
  }
  if (!Array.isArray(rules.pathwayRules) || rules.pathwayRules.length === 0) {
    throw new Error('pathwayRules must be a non-empty list.')
  }
  scoreTriage({ domains: ['speech'], riskFlags: [], redFlag: false }, rules)
  scoreTriage({ domains: ['speech'], riskFlags: ['stroke'], redFlag: true }, rules)
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
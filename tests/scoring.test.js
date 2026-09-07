import { describe, it, expect } from 'vitest'
import { scoreTriage, classifyComplexity, classifyRisk, evaluatePathway } from '../src/lib/scoring.js'
import DEFAULT_RULES from '../src/lib/defaultRules.json'

const base = { domains: ['speech'], riskFlags: [], redFlag: false }

describe('classifyComplexity', () => {
  it('1 domain is Simple', () => expect(classifyComplexity(1, DEFAULT_RULES.complexityThresholds)).toBe('Simple'))
  it('2 domains is Moderate', () => expect(classifyComplexity(2, DEFAULT_RULES.complexityThresholds)).toBe('Moderate'))
  it('3+ domains is Complex', () => {
    expect(classifyComplexity(3, DEFAULT_RULES.complexityThresholds)).toBe('Complex')
    expect(classifyComplexity(5, DEFAULT_RULES.complexityThresholds)).toBe('Complex')
  })
})

describe('classifyRisk', () => {
  it('0 flags is Low', () => expect(classifyRisk(0, DEFAULT_RULES.riskThresholds)).toBe('Low'))
  it('1-2 flags is Moderate', () => {
    expect(classifyRisk(1, DEFAULT_RULES.riskThresholds)).toBe('Moderate')
    expect(classifyRisk(2, DEFAULT_RULES.riskThresholds)).toBe('Moderate')
  })
  it('3+ flags is High', () => expect(classifyRisk(3, DEFAULT_RULES.riskThresholds)).toBe('High'))
})

describe('pathway evaluation order (first match wins)', () => {
  it('red flag always routes to REFER OUT regardless of other inputs', () => {
    const out = scoreTriage({ ...base, redFlag: true, domains: ['speech', 'mobility', 'cognition'], riskFlags: ['stroke', 'cardiac', 'diabetes'] })
    expect(out.pathwayId).toBe('refer_out')
  })

  it('1 domain + 0 risk → SINGLE DOMAIN PATHWAY', () => {
    const out = scoreTriage(base)
    expect(out.pathwayId).toBe('single_domain')
  })

  it('2 domains → MODERATE/DUAL PATHWAY', () => {
    const out = scoreTriage({ ...base, domains: ['speech', 'mobility'] })
    expect(out.pathwayId).toBe('dual')
  })

  it('risk 1–2 → MODERATE/DUAL PATHWAY', () => {
    const out = scoreTriage({ ...base, riskFlags: ['stroke'] })
    expect(out.pathwayId).toBe('dual')
  })

  it('3 domains → MDT + RISK SCREENING', () => {
    const out = scoreTriage({ ...base, domains: ['speech', 'mobility', 'cognition'] })
    expect(out.pathwayId).toBe('mdt')
  })

  it('3+ risk → MDT + RISK SCREENING', () => {
    const out = scoreTriage({ ...base, riskFlags: ['stroke', 'cardiac', 'diabetes'] })
    expect(out.pathwayId).toBe('mdt')
  })

  it('computed complexity/risk reflect inputs', () => {
    const out = scoreTriage({ ...base, domains: ['speech', 'mobility', 'cognition'] })
    expect(out.complexity).toBe('Complex')
    const out2 = scoreTriage({ ...base, riskFlags: ['stroke', 'cardiac', 'diabetes'] })
    expect(out2.riskLevel).toBe('High')
  })
})

describe('custom rules drive scoring', () => {
  it('changing the high-risk threshold changes the risk level', () => {
    const rules = {
      ...DEFAULT_RULES,
      riskThresholds: { ...DEFAULT_RULES.riskThresholds, high: 1 },
    }
    const out = scoreTriage({ ...base, riskFlags: ['stroke'] }, rules)
    expect(out.riskLevel).toBe('High')
    expect(out.pathwayId).toBe('dual')
  })
})

describe('evaluatePathway', () => {
  it('handles empty rule list without crashing', () => {
    const result = evaluatePathway({ domainsCount: 1, riskScore: 0, redFlag: false }, [])
    expect(result).toBeDefined()
  })
})

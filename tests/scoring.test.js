import { describe, it, expect } from 'vitest'
import {
  scoreTriage,
  scoreV1,
  scoreV2,
  classifyComplexity,
  classifyRisk,
  evaluatePathway,
  formatNaira,
} from '../src/lib/scoring.js'
import DEFAULT_RULES from '../src/lib/defaultRules.json'

/* ------------------------------ V1 (legacy) ------------------------------ */

const baseV1 = { domains: ['speech'], riskFlags: [], redFlag: false }

describe('classifyComplexity', () => {
  it('1 domain is Simple', () => expect(classifyComplexity(1, DEFAULT_RULES.v1.complexityThresholds)).toBe('Simple'))
  it('2 domains is Moderate', () => expect(classifyComplexity(2, DEFAULT_RULES.v1.complexityThresholds)).toBe('Moderate'))
  it('3+ domains is Complex', () => {
    expect(classifyComplexity(3, DEFAULT_RULES.v1.complexityThresholds)).toBe('Complex')
    expect(classifyComplexity(5, DEFAULT_RULES.v1.complexityThresholds)).toBe('Complex')
  })
})

describe('classifyRisk', () => {
  it('0 flags is Low', () => expect(classifyRisk(0, DEFAULT_RULES.v1.riskThresholds)).toBe('Low'))
  it('1-2 flags is Moderate', () => {
    expect(classifyRisk(1, DEFAULT_RULES.v1.riskThresholds)).toBe('Moderate')
    expect(classifyRisk(2, DEFAULT_RULES.v1.riskThresholds)).toBe('Moderate')
  })
  it('3+ flags is High', () => expect(classifyRisk(3, DEFAULT_RULES.v1.riskThresholds)).toBe('High'))
})

describe('v1 pathway evaluation order (first match wins)', () => {
  it('red flag always routes to REFER OUT regardless of other inputs', () => {
    const out = scoreV1({ ...baseV1, redFlag: true, domains: ['speech', 'mobility', 'cognition'], riskFlags: ['stroke', 'cardiac', 'diabetes'] }, DEFAULT_RULES)
    expect(out.pathwayId).toBe('refer_out')
  })

  it('1 domain + 0 risk → SINGLE DOMAIN PATHWAY', () => {
    const out = scoreV1(baseV1, DEFAULT_RULES)
    expect(out.pathwayId).toBe('single_domain')
  })

  it('2 domains → MODERATE/DUAL PATHWAY', () => {
    const out = scoreV1({ ...baseV1, domains: ['speech', 'mobility'] }, DEFAULT_RULES)
    expect(out.pathwayId).toBe('dual')
  })

  it('risk 1–2 → MODERATE/DUAL PATHWAY', () => {
    const out = scoreV1({ ...baseV1, riskFlags: ['stroke'] }, DEFAULT_RULES)
    expect(out.pathwayId).toBe('dual')
  })

  it('3 domains → MDT + RISK SCREENING', () => {
    const out = scoreV1({ ...baseV1, domains: ['speech', 'mobility', 'cognition'] }, DEFAULT_RULES)
    expect(out.pathwayId).toBe('mdt')
  })

  it('3+ risk → MDT + RISK SCREENING', () => {
    const out = scoreV1({ ...baseV1, riskFlags: ['stroke', 'cardiac', 'diabetes'] }, DEFAULT_RULES)
    expect(out.pathwayId).toBe('mdt')
  })

  it('computed complexity/risk reflect inputs', () => {
    const out = scoreV1({ ...baseV1, domains: ['speech', 'mobility', 'cognition'] }, DEFAULT_RULES)
    expect(out.complexity).toBe('Complex')
    const out2 = scoreV1({ ...baseV1, riskFlags: ['stroke', 'cardiac', 'diabetes'] }, DEFAULT_RULES)
    expect(out2.riskLevel).toBe('High')
  })
})

describe('v1 custom rules drive scoring', () => {
  it('changing the high-risk threshold changes the risk level', () => {
    const rules = {
      ...DEFAULT_RULES,
      v1: { ...DEFAULT_RULES.v1, riskThresholds: { ...DEFAULT_RULES.v1.riskThresholds, high: 1 } },
    }
    const out = scoreV1({ ...baseV1, riskFlags: ['stroke'] }, rules)
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

/* ------------------------------ V2 (new brief) ------------------------------ */

const painNone = { severity: 'none', worsening: false, recentInjury: false, neurological: false }

describe('v2 discipline mapping', () => {
  it('maps walking → Physiotherapy (PT)', () => {
    const out = scoreV2({ problems: ['walking'], pain: painNone, acute: false }, DEFAULT_RULES)
    expect(out.model).toBe('v2')
    expect(out.disciplines).toEqual(['PT'])
    expect(out.primaryDiscipline).toBe('PT')
    expect(out.disciplinesCount).toBe(1)
  })

  it('OT is primary when no PT problem is selected', () => {
    const out = scoreV2({ problems: ['dressing'], pain: painNone, acute: false }, DEFAULT_RULES)
    expect(out.disciplines).toEqual(['OT'])
    expect(out.primaryDiscipline).toBe('OT')
  })

  it('dressing + speech maps to OT + SLT', () => {
    const out = scoreV2({ problems: ['dressing', 'speech'], pain: painNone, acute: false }, DEFAULT_RULES)
    expect(out.disciplines).toEqual(['OT', 'SLT'])
  })

  it('swallowing triggers SLT', () => {
    const out = scoreV2({ problems: ['swallowing'], pain: painNone, acute: false }, DEFAULT_RULES)
    expect(out.disciplines).toEqual(['SLT'])
  })

  it('primary is fixed-order (PT first) regardless of selection order', () => {
    const out = scoreV2({ problems: ['dressing', 'walking'], pain: painNone, acute: false }, DEFAULT_RULES)
    expect(out.primaryDiscipline).toBe('PT')
    expect(out.additionalDisciplinesLabels).toEqual(['Occupational Therapy'])
  })

  it('stroke-style presentation maps to PT + OT + SLT (multidisciplinary)', () => {
    const out = scoreV2({ problems: ['walking', 'dressing', 'speech'], pain: painNone, acute: false }, DEFAULT_RULES)
    expect(out.disciplinesCount).toBe(3)
    expect(out.complexity).toBe('Multidisciplinary')
  })
})

describe('v2 red-flag scoring and decision bands', () => {
  it('flag A (3) + acute → emergency, High risk, no fee', () => {
    const out = scoreV2({ problems: ['walking'], redFlagAnswers: ['A'], pain: painNone, acute: true }, DEFAULT_RULES)
    expect(out.redFlagScore).toBe(3)
    expect(out.redFlagDecision).toBe('emergency')
    expect(out.riskLevel).toBe('High')
    expect(out.fee).toBeNull()
    expect(out.assessmentFeeLabel).toContain('Not applicable')
    expect(out.pathwayId).toBe('urgent_referral')
  })

  it('flag A (3) but NOT acute → urgent clinical review', () => {
    const out = scoreV2({ problems: ['walking'], redFlagAnswers: ['A'], pain: painNone, acute: false }, DEFAULT_RULES)
    expect(out.redFlagDecision).toBe('urgent_review')
    expect(out.riskLevel).toBe('Moderate')
  })

  it('flag G (score 2) → urgent clinical review', () => {
    const out = scoreV2({ problems: ['walking'], redFlagAnswers: ['G'], pain: painNone, acute: false }, DEFAULT_RULES)
    expect(out.redFlagDecision).toBe('urgent_review')
    expect(out.riskLevel).toBe('Moderate')
  })

  it('flag E (score 1, recent major event) → green, Low risk, fee applies', () => {
    const out = scoreV2({ problems: ['walking'], redFlagAnswers: ['E'], pain: painNone, acute: false }, DEFAULT_RULES)
    expect(out.redFlagDecision).toBe('green')
    expect(out.riskLevel).toBe('Low')
    expect(out.fee).toBe(25000)
  })

  it('clinician judgement of instability triggers emergency regardless of score', () => {
    const out = scoreV2({ problems: ['walking'], pain: painNone, acute: false, clinicianUnstable: true }, DEFAULT_RULES)
    expect(out.redFlagDecision).toBe('emergency')
  })

  it('severe pain + recent injury derives H = 3', () => {
    const out = scoreV2(
      { problems: ['walking'], pain: { severity: 'severe', worsening: false, recentInjury: true, neurological: false }, acute: true },
      DEFAULT_RULES,
    )
    expect(out.painScore).toBe(3)
    expect(out.redFlagDecision).toBe('emergency')
  })

  it('severe pain without injury is H = 2 (urgent, not emergency)', () => {
    const out = scoreV2(
      { problems: ['walking'], pain: { severity: 'severe', worsening: false, recentInjury: false, neurological: false }, acute: false },
      DEFAULT_RULES,
    )
    expect(out.painScore).toBe(2)
    expect(out.redFlagDecision).toBe('urgent_review')
  })
})

describe('v2 fees are discipline-neutral', () => {
  it('single discipline → ₦25,000', () => {
    const p = (problems) => scoreV2({ problems, pain: painNone, acute: false }, DEFAULT_RULES)
    expect(p(['walking']).fee).toBe(25000)
    expect(p(['dressing']).fee).toBe(25000)
    expect(p(['hearing_speech']).fee).toBe(25000)
    expect(p(['behaviour']).fee).toBe(25000)
    expect(p(['distress']).fee).toBe(25000)
  })

  it('two disciplines → ₦50,000 regardless of which two (OT neutrality)', () => {
    const p = (problems) => scoreV2({ problems, pain: painNone, acute: false }, DEFAULT_RULES)
    expect(p(['walking', 'dressing']).fee).toBe(50000)
    expect(p(['dressing', 'speech']).fee).toBe(50000)
    expect(p(['dressing', 'hearing_speech']).fee).toBe(50000)
    expect(p(['walking', 'speech']).fee).toBe(50000)
  })

  it('three or more disciplines → ₦75,000', () => {
    const p = (problems) => scoreV2({ problems, pain: painNone, acute: false }, DEFAULT_RULES)
    expect(p(['walking', 'dressing', 'speech']).fee).toBe(75000)
    expect(p(['walking', 'dressing', 'speech', 'behaviour']).fee).toBe(75000)
  })

  it('emergency referral suppresses the assessment fee', () => {
    const out = scoreV2({ problems: ['walking', 'dressing', 'speech'], redFlagAnswers: ['B'], pain: painNone, acute: true }, DEFAULT_RULES)
    expect(out.fee).toBeNull()
    expect(out.pathwayId).toBe('urgent_referral')
  })
})

describe('v2 complexity', () => {
  it('1 → Single-discipline, 2 → Two-discipline, 3 → Multidisciplinary', () => {
    const p = (problems) => scoreV2({ problems, pain: painNone, acute: false }, DEFAULT_RULES)
    expect(p(['walking']).complexity).toBe('Single-discipline')
    expect(p(['walking', 'dressing']).complexity).toBe('Two-discipline')
    expect(p(['walking', 'dressing', 'speech']).complexity).toBe('Multidisciplinary')
  })
})

describe('v2 pathway rules (first match wins)', () => {
  it('emergency short-circuits discipline-based routing', () => {
    const out = scoreV2({ problems: ['walking'], redFlagAnswers: ['A'], pain: painNone, acute: true }, DEFAULT_RULES)
    expect(out.pathwayId).toBe('urgent_referral')
  })

  it('urgent clinical review precedes discipline-based routing', () => {
    const out = scoreV2({ problems: ['walking', 'dressing', 'speech'], redFlagAnswers: ['G'], pain: painNone, acute: false }, DEFAULT_RULES)
    expect(out.pathwayId).toBe('clinical_review')
  })

  it('single discipline → single assessment', () => {
    const out = scoreV2({ problems: ['dressing'], pain: painNone, acute: false }, DEFAULT_RULES)
    expect(out.pathwayId).toBe('single')
  })

  it('two disciplines → dual assessment', () => {
    const out = scoreV2({ problems: ['dressing', 'hearing_speech'], pain: painNone, acute: false }, DEFAULT_RULES)
    expect(out.pathwayId).toBe('dual')
  })

  it('three disciplines → multidisciplinary assessment', () => {
    const out = scoreV2({ problems: ['walking', 'dressing', 'speech'], pain: painNone, acute: false }, DEFAULT_RULES)
    expect(out.pathwayId).toBe('mdt')
  })
})

describe('dispatcher + helpers', () => {
  it('scoreTriage uses v2 by default', () => {
    const out = scoreTriage({ problems: ['walking'], pain: painNone, acute: false })
    expect(out.model).toBe('v2')
    expect(out.primaryDiscipline).toBe('PT')
  })

  it('scoreTriage delegates to v1 when activeModel = v1', () => {
    const rules = { ...DEFAULT_RULES, activeModel: 'v1' }
    const out = scoreTriage({ domains: ['speech'], riskFlags: [], redFlag: false }, rules)
    expect(out.model).toBe('v1')
    expect(out.pathwayId).toBe('single_domain')
  })

  it('formatNaira formats Naira amounts', () => {
    expect(formatNaira(25000)).toBe('₦25,000')
    expect(formatNaira(null)).toBe('')
  })
})
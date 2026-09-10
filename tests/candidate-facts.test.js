import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeExperienceText, candidateExperienceSources, compareSalary, extractExpectedSalaryLpa } from '../src/candidateFacts.js'

test('salary comparison reports the exact difference from the requisition ceiling', () => {
  const above = compareSalary({ expectedSalaryLpa: 11 }, { constraints: { maxSalaryLpa: 8 } })
  assert.deepEqual({ status: above.status, delta: above.delta, label: above.label }, { status: 'above-cap', delta: 3, label: '₹3 LPA above the job ceiling' })
  const within = compareSalary({ expectedSalaryLpa: 7 }, { constraints: { maxSalaryLpa: 8 } })
  assert.equal(within.delta, -1)
  assert.equal(within.status, 'within-cap')
})

test('salary expectation can be read from explicit application wording', () => {
  assert.equal(extractExpectedSalaryLpa('Expected CTC: ₹9.5 LPA'), 9.5)
  const comparison = compareSalary({ text: 'Salary expectation: INR 7 LPA' }, { constraints: { maxSalaryLpa: 8 } })
  assert.equal(comparison.delta, -1)
  assert.equal(comparison.expectationSource, 'application text')
})

test('resume experience separates a claim from dated and responsibility evidence', () => {
  const result = analyzeExperienceText('Sam Lee\nEngineer — 5 years experience\nEXPERIENCE\nEngineer, Example (2024–Present)\nBuilt and operated Java services.', new Date('2026-09-10'))
  assert.equal(result.claimedYears, 5)
  assert.ok(result.timelineYears >= 2)
  assert.equal(result.supportedYears, result.timelineYears)
  assert.equal(result.status, 'dated-timeline')
  assert.match(result.supportingPassages[0].quote, /Built and operated/)
})

test('unsupported duration flags prevent an unverified resume claim from becoming supported tenure', () => {
  const candidate = {
    text: '5 years of Python experience',
    flags: [{ rule: 'duration', assessment: 'No dated evidence.' }],
    verification: {},
  }
  const sources = candidateExperienceSources(candidate, { constraints: { minExperienceYears: 5 } })
  assert.equal(sources.resume.status, 'conflicting')
  assert.equal(sources.resume.supportedYears, null)
})

test('GitHub activity remains separate from professional experience', () => {
  const sources = candidateExperienceSources({ text: '', verification: { github: { activity: { spanYears: 4, repositoryCount: 3 } } } }, { constraints: { minExperienceYears: 4 } })
  assert.equal(sources.resume.supportedYears, null)
  assert.equal(sources.github.spanYears, 4)
})

test('older LinkedIn results without parsed experience retain responsibility evidence', () => {
  const candidate = { text: '', verification: { linkedin: { status: 'review-ready', evidence: ['Engineer, Example (2021–2025)', 'Built and operated backend services.'] } } }
  const sources = candidateExperienceSources(candidate, { constraints: { minExperienceYears: 3 } })
  assert.ok(sources.linkedin.supportedYears >= 4)
  assert.match(sources.linkedin.supportingPassages[0].quote, /Built and operated/)
})

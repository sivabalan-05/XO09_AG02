import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultRequisition, sampleCandidates } from '../src/data.js'
import { screenPool } from '../src/screening.js'
import { analyzeRequisition } from '../src/requisitionAnalysis.js'
import { screenCandidate } from '../src/screening.js'

test('analysis explicitly reports when no candidate satisfies every required area', () => {
  const screened = screenPool(sampleCandidates, defaultRequisition)
  const analysis = analyzeRequisition(screened, defaultRequisition)
  assert.equal(analysis.noFullMatch, true)
  assert.equal(analysis.fullMatches.length, 0)
  assert.ok(analysis.requirementCoverage.some((item) => item.name === 'Multi-region failover ownership' && item.met === 0))
})

test('analysis flags junior, experience, and salary restriction trade-offs without inventing salary data', () => {
  const requisition = { ...defaultRequisition, constraints: { minExperienceYears: 5, maxSalaryLpa: 8, seniority: 'junior' } }
  const pool = screenPool(sampleCandidates.map((candidate, index) => ({ ...candidate, expectedSalaryLpa: index === 0 ? 11 : index === 1 ? 7 : undefined })), requisition)
  const analysis = analyzeRequisition(pool, requisition)
  assert.ok(analysis.conflicts.some((conflict) => conflict.id === 'junior-experience'))
  assert.ok(analysis.conflicts.some((conflict) => conflict.id === 'salary-experience'))
  assert.ok(analysis.requirementCoverage.some((item) => item.id === 'salary' && item.met === 1))
  assert.ok(analysis.shortlist.every((item) => Array.isArray(item.tradeoffs)))
})

test('multi-region assessment accepts scale above 10k rather than only the literal example', () => {
  const candidate = { id: 'scale', name: 'Scale Test', text: 'EXPERIENCE\nLed production multi-region Java services on AWS across two regions, sustaining 18,000 requests per second. Introduced regional failover drills and Grafana alerting.' }
  const result = screenCandidate(candidate, defaultRequisition)
  assert.equal(result.assessments.find((item) => item.criterionId === 'multiregion').level, 'strong')
})

test('plain-language total experience claims are evaluated against the experience floor', () => {
  const requisition = { ...defaultRequisition, constraints: { minExperienceYears: 5, maxSalaryLpa: null, seniority: 'mid' } }
  const candidate = screenCandidate({ id: 'years', name: 'Years Test', text: 'SUMMARY\n6 years of professional experience building Java services.\nEDUCATION\nB.Tech 2014 - 2018' }, requisition)
  const analysis = analyzeRequisition([candidate], requisition)
  assert.equal(analysis.requirementCoverage.find((item) => item.id === 'experience').met, 1)
})

test('role headers with an em-dash duration remain valid experience evidence', () => {
  const requisition = { ...defaultRequisition, constraints: { minExperienceYears: 4, maxSalaryLpa: null, seniority: 'mid' } }
  const candidate = screenCandidate({ id: 'header-years', name: 'Header Years', text: 'Header Years\nPlatform Engineer — 4 years\nEXPERIENCE\nBuilt and operated Java services.' }, requisition)
  const analysis = analyzeRequisition([candidate], requisition)
  assert.equal(analysis.requirementCoverage.find((item) => item.id === 'experience').met, 1)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultRequisition, sampleCandidates } from '../src/data.js'
import { screenCandidate } from '../src/screening.js'

const githubSignal = (criterionId, criterionName, repo = 'weatherGPT') => ({
  github: {
    provider: 'GitHub', status: 'review-ready',
    criteriaSignals: [{ criterionId, criterion: criterionName, terms: ['python'], source: 'GitHub', repo, repoUrl: `https://github.com/octocat/${repo}` }],
  },
})

test('a verified GitHub repo lifts a bare resume skill mention by one step and cites the repo', () => {
  const candidate = { id: 'T-01', name: 'Test Candidate', text: 'Skills: Python, SQL' }
  const before = screenCandidate(candidate, defaultRequisition).assessments.find((a) => a.criterionId === 'backend')
  assert.equal(before.level, 'emerging')

  const withVerification = { ...candidate, verification: githubSignal('backend', 'Backend engineering') }
  const after = screenCandidate(withVerification, defaultRequisition).assessments.find((a) => a.criterionId === 'backend')
  assert.equal(after.level, 'partial')
  assert.ok(after.confidence > before.confidence)
  assert.equal(after.externalCorroboration[0].repo, 'weatherGPT')
  assert.match(after.reason, /Cross-checked.*weatherGPT/)
})

test('external corroboration is capped at "supported" and never promotes a criterion to "strong"', () => {
  const candidate = { id: 'T-02', name: 'Test Candidate', text: 'Built Python scripts to automate reports.' }
  const before = screenCandidate(candidate, defaultRequisition).assessments.find((a) => a.criterionId === 'backend')
  assert.equal(before.level, 'supported')

  const withVerification = { ...candidate, verification: githubSignal('backend', 'Backend engineering') }
  const after = screenCandidate(withVerification, defaultRequisition).assessments.find((a) => a.criterionId === 'backend')
  assert.equal(after.level, 'supported')
  assert.equal(after.confidence, 80)
})

test('external corroboration never overrides a contradicted criterion', () => {
  const candidate = sampleCandidates.find((c) => c.id === 'A-14')
  const before = screenCandidate(candidate, defaultRequisition).assessments.find((a) => a.criterionId === 'cloud')
  assert.equal(before.level, 'conflicting')

  const withVerification = { ...candidate, verification: githubSignal('cloud', 'Cloud deployment') }
  const after = screenCandidate(withVerification, defaultRequisition).assessments.find((a) => a.criterionId === 'cloud')
  assert.equal(after.level, 'conflicting')
  assert.equal(after.externalCorroboration, undefined)
})

test('candidates with no verification data score identically to before this feature existed', () => {
  const candidate = sampleCandidates.find((c) => c.id === 'A-01')
  const result = screenCandidate(candidate, defaultRequisition)
  assert.ok(result.assessments.every((a) => a.externalCorroboration === undefined))
})

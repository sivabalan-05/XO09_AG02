import test from 'node:test'
import assert from 'node:assert/strict'
import { detectContradictions } from '../src/contradictions.js'
import { defaultRequisition, sampleCandidates } from '../src/data.js'
import { screenCandidate } from '../src/screening.js'

const check = (text) => detectContradictions(text, defaultRequisition, new Date('2026-09-09'))
test('challenge example is unsupported, not proof of contradictory dates', () => {
  const text = sampleCandidates.find((c) => c.id === 'A-13').text
  const flag = check(text).find((f) => f.rule === 'duration')
  assert.equal(flag.kind, 'unsupported')
  assert.equal(flag.claim.quote, '5 years of Python experience')
  assert.ok(flag.evidence.some((ref) => ref.quote === '2024 – 2025'))
  assert.ok(!flag.evidence.some((ref) => ref.quote === '2021 – 2025'))
})
test('resume/cover-note conflict lowers affected confidence and cannot count as strong', () => {
  const candidate = sampleCandidates.find((c) => c.id === 'A-14')
  const result = screenCandidate(candidate, defaultRequisition)
  const cloud = result.assessments.find((a) => a.criterionId === 'cloud')
  assert.equal(cloud.level, 'conflicting')
  assert.ok(cloud.confidence <= 35)
  assert.ok(result.confidence < result.unadjustedConfidence)
  assert.ok(result.flags.some((f) => f.evidence.some((r) => r.section === 'COVER NOTE')))
})
test('title responsibility limits and course-only expertise are flagged', () => {
  const flags = check(sampleCandidates.find((c) => c.id === 'A-15').text)
  assert.ok(flags.some((f) => f.rule === 'title-scope'))
  assert.ok(flags.some((f) => f.rule === 'expertise'))
})
test('dated independent work can support experience before graduation', () => {
  const flags = check('5 years of Python experience\nPROJECTS\nPython developer, 2018 – 2023\nBuilt Python tools for a local club.\nEDUCATION\nB.Tech, 2021 – 2025')
  assert.ok(!flags.some((f) => f.rule === 'duration'))
})
test('overlapping jobs do not double-count experience', () => {
  const flags = check('5 years of Python experience\nEXPERIENCE\nPython developer, 2023 – 2024\nBuilt Python tools.\nPython consultant, 2023 – 2024\nBuilt Python APIs.')
  assert.ok(flags.some((f) => f.rule === 'duration'))
})
test('education alone cannot establish skill duration', () => {
  assert.ok(check('5 years of Python experience\nEDUCATION\nPython coursework, 2018 – 2025').some((f) => f.rule === 'duration'))
})
test('different skills in the same criterion do not contradict each other', () => {
  assert.ok(!check('Built Python APIs.\nCOVER NOTE\nI have never used Java.').some((f) => f.kind === 'contradictory'))
  assert.ok(!check('Built JavaScript APIs.\nCOVER NOTE\nI have never used Java.').some((f) => f.kind === 'contradictory'))
})
test('academic work and lack of production experience are compatible', () => {
  assert.ok(!check('PROJECTS\nBuilt Python tools for a course.\nCOVER NOTE\nI have never used Python in production.').some((f) => f.kind === 'contradictory'))
})
test('expert claim backed by independent same-skill work is not automatically flagged', () => {
  assert.ok(!check('Expert in Python.\nEXPERIENCE\nBuilt Python services processing 300 requests per second.').some((f) => f.rule === 'expertise'))
})
test('every flag reference is an exact source slice with the correct line', () => {
  for (const candidate of sampleCandidates) {
    for (const flag of check(candidate.text)) {
      for (const ref of [flag.claim, ...flag.evidence]) {
        assert.equal(candidate.text.slice(ref.start, ref.end), ref.quote)
        assert.ok(candidate.text.split('\n')[ref.line - 1].includes(ref.quote))
      }
    }
    const screened = screenCandidate(candidate, defaultRequisition)
    assert.ok(Number.isFinite(screened.evidenceCoverage))
  }
})
test('same-line opposing statements retain exact source offsets', () => {
  const text = 'Built Python APIs. I have never used Python.'
  const flag = check(text).find((f) => f.kind === 'contradictory')
  assert.ok(flag)
  for (const ref of [flag.claim, ...flag.evidence]) assert.equal(text.slice(ref.start, ref.end), ref.quote)
})
test('different current durations for same skill are a cited conflict', () => {
  assert.ok(check('5 years of Python experience\nCOVER NOTE\nI have 1 year of Python experience.').some((f) => f.rule === 'duration-conflict'))
})
test('missing criteria do not inflate confidence in unsupported claims', () => {
  const result = screenCandidate(sampleCandidates.find((c) => c.id === 'A-13'), defaultRequisition)
  assert.ok(result.confidence <= 50)
  assert.ok(result.confidenceReduction > 0)
})
test('time-qualified statements are not treated as unconditional denials', () => {
  assert.ok(!check('Built Python APIs in 2019.\nI have not used Python since 2020.').some((f) => f.kind === 'contradictory'))
})

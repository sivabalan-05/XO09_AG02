import test from 'node:test'
import assert from 'node:assert/strict'
import { createScreeningAgent } from '../agent/orchestrator.js'
import { verifyGitHubProfile, verifyLinkedInEvidence } from '../agent/verifiers.js'
import { defaultRequisition, sampleCandidates } from '../src/data.js'

test('LangChain workflow returns a trace and a human-review recommendation', async () => {
  const result = await createScreeningAgent({ useModel: false }).invoke({ candidate: sampleCandidates[0], requisition: defaultRequisition })
  assert.equal(result.trace.length, 3)
  assert.deepEqual(result.trace.map((entry) => entry.step), ['Application intake', 'Evidence & contradiction review', 'Human-review decision'])
  assert.match(result.recommendation, /review|validation/i)
  assert.equal(result.modelStatus, 'disabled')
  assert.equal('candidate' in result, false)
  assert.equal('requisition' in result, false)
  assert.equal('assessment' in result, false)
})

test('LinkedIn requires consented evidence and does not scrape a URL', () => {
  const result = verifyLinkedInEvidence({ url: 'https://www.linkedin.com/in/example' })
  assert.equal(result.status, 'needs-authorized-export')
  assert.match(result.message, /not scraped/i)
})

test('LinkedIn authorized text returns separate experience evidence', () => {
  const result = verifyLinkedInEvidence({ authorizedText: 'EXPERIENCE\nEngineer, Example (2021–2025)\nBuilt and operated backend services.' })
  assert.equal(result.status, 'review-ready')
  assert.ok(result.experience.timelineYears >= 4)
  assert.match(result.experience.supportingPassages[0].quote, /Built and operated/)
})

test('GitHub verifier rejects non-GitHub URLs without making a network request', async () => {
  const result = await verifyGitHubProfile('https://example.com/github-user', defaultRequisition)
  assert.equal(result.status, 'needs-input')
})

test('GitHub verification reports an observable repository activity span without calling it employment', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/users/example')) return { ok: true, json: async () => ({ login: 'example', html_url: 'https://github.com/example', public_repos: 2, name: 'Example', created_at: '2019-01-01T00:00:00Z' }) }
    return { ok: true, json: async () => ([
      { name: 'one', html_url: 'https://github.com/example/one', description: 'Java service', language: 'Java', topics: [], fork: false, created_at: '2021-01-01T00:00:00Z', pushed_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
      { name: 'two', html_url: 'https://github.com/example/two', description: 'Terraform examples', language: 'HCL', topics: [], fork: false, created_at: '2022-01-01T00:00:00Z', pushed_at: '2023-01-01T00:00:00Z', updated_at: '2023-01-01T00:00:00Z' },
    ]) }
  }
  try {
    const result = await verifyGitHubProfile('example', defaultRequisition)
    assert.equal(result.status, 'review-ready')
    assert.equal(result.activity.spanYears, 3)
    assert.match(result.disclaimer, /does not prove employment/i)
  } finally { globalThis.fetch = originalFetch }
})

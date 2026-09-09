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

test('GitHub verifier rejects non-GitHub URLs without making a network request', async () => {
  const result = await verifyGitHubProfile('https://example.com/github-user', defaultRequisition)
  assert.equal(result.status, 'needs-input')
})

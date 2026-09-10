import test from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import {
  createRequirementIntelligenceAgent,
  requirementIntelligenceInputSchema,
  requirementProposalSchema,
} from '../agent/requirementIntelligence.js'
import {
  applyRequirementProposal,
  createStableCriterionId,
  getDefaultSuggestionKeys,
  suggestionKey,
} from '../src/requirementSuggestions.js'

const input = {
  mode: 'enrich',
  roleTitle: 'Platform Engineer',
  jobDescription: 'Operate reliable services on AWS.',
  criteria: [{
    id: 'cloud',
    name: 'Cloud deployment',
    type: 'required',
    description: 'Deploy and operate workloads in a public cloud.',
    aliases: ['AWS'],
  }],
}

const rawProposal = {
  mode: 'enrich',
  criteria: [{
    sourceCriterionId: 'cloud',
    name: ' Cloud deployment ',
    type: 'required',
    description: ' Deploy and operate workloads in a public cloud. ',
    suggestions: [
      { term: ' Amazon Web Services ', relationship: 'technology', reason: 'Names AWS in full.' },
      { term: 'amazon   web services', relationship: 'equivalent', reason: 'Duplicate spelling.' },
      { term: 'software', relationship: 'related', reason: 'Too broad to be useful.' },
      { term: 'AWS', relationship: 'technology', reason: 'Already present in the requisition.' },
    ],
  }],
  warnings: [],
}

class FakeModel {
  constructor(response) {
    this.response = response
    this.calls = []
    this.schema = null
    this.modelName = 'fake-requirements-model'
  }

  withStructuredOutput(schema) {
    this.schema = schema
    return {
      invoke: async (messages, config) => {
        this.calls.push({ messages, config })
        return this.response
      },
    }
  }
}

test('input and output contracts are strict and bounded', () => {
  assert.throws(
    () => requirementIntelligenceInputSchema.parse({ ...input, candidates: [{ name: 'Private Person' }] }),
    z.ZodError,
  )
  assert.throws(
    () => requirementIntelligenceInputSchema.parse({ ...input, mode: 'merge' }),
    z.ZodError,
  )
  assert.throws(
    () => requirementProposalSchema.parse({ ...rawProposal, unexpected: true }),
    z.ZodError,
  )
})

test('LangChain structured-output workflow sends only the minimized requisition input', async () => {
  const model = new FakeModel(rawProposal)
  const signal = new AbortController().signal
  const result = await createRequirementIntelligenceAgent({ model }).invoke(input, { signal })

  assert.ok(model.schema)
  assert.equal(model.calls.length, 1)
  assert.equal(model.calls[0].config.signal, signal)
  const serializedPrompt = JSON.stringify(model.calls[0].messages)
  assert.match(serializedPrompt, /Platform Engineer/)
  assert.doesNotMatch(serializedPrompt, /candidate|salary|Private Person/i)
  assert.equal(result.mode, 'enrich')
  assert.equal(result.model, 'fake-requirements-model')
  assert.match(result.generatedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('normalization removes duplicates, existing aliases, and overly broad terms', async () => {
  const result = await createRequirementIntelligenceAgent({ model: new FakeModel(rawProposal) }).invoke(input)

  assert.deepEqual(result.criteria[0].suggestions.map((item) => item.term), ['Amazon Web Services'])
  assert.ok(result.warnings.some((warning) => /duplicate/i.test(warning)))
  assert.ok(result.warnings.some((warning) => /broad/i.test(warning)))
  assert.ok(result.warnings.some((warning) => /already exists/i.test(warning)))
})

test('enrich applies selected safe suggestions without mutating the draft', () => {
  const draft = { id: 'JR-1', title: 'Platform Engineer', criteria: input.criteria }
  const proposal = {
    mode: 'enrich', model: 'fake', generatedAt: '2026-09-10T00:00:00.000Z', warnings: [],
    criteria: [{
      sourceCriterionId: 'cloud', name: 'Cloud deployment', type: 'required', description: 'Cloud work.',
      suggestions: [
        { term: 'Amazon Web Services', relationship: 'equivalent', reason: 'Full name.' },
        { term: 'EKS', relationship: 'technology', reason: 'Relevant managed Kubernetes.' },
        { term: 'infrastructure', relationship: 'related', reason: 'Contextual only.' },
      ],
    }],
  }
  const selected = new Set([suggestionKey(0, 0), suggestionKey(0, 1), suggestionKey(0, 2)])
  const result = applyRequirementProposal(draft, proposal, selected)

  assert.deepEqual(result.criteria[0].aliases, ['AWS', 'Amazon Web Services', 'EKS', 'infrastructure'])
  assert.deepEqual(draft.criteria[0].aliases, ['AWS'])
  assert.deepEqual([...getDefaultSuggestionKeys(proposal)], ['0:0', '0:1'])
})

test('replace creates deterministic collision-safe criterion IDs and omits related suggestions by default', () => {
  const draft = { id: 'JR-1', title: 'Old title', criteria: input.criteria }
  const proposal = {
    mode: 'replace', model: 'fake', generatedAt: '2026-09-10T00:00:00.000Z', warnings: [],
    criteria: [
      {
        sourceCriterionId: null, name: 'Service Ownership', type: 'required', description: 'Own services.',
        suggestions: [
          { term: 'on-call', relationship: 'equivalent', reason: 'Ownership signal.' },
          { term: 'communication', relationship: 'related', reason: 'Helpful context.' },
        ],
      },
      { sourceCriterionId: null, name: 'Service Ownership', type: 'preferred', description: 'Support services.', suggestions: [] },
    ],
  }
  const result = applyRequirementProposal(draft, proposal)

  assert.deepEqual(result.criteria.map((criterion) => criterion.id), ['service-ownership', 'service-ownership-2'])
  assert.deepEqual(result.criteria[0].aliases, ['on-call'])
  assert.deepEqual(result.criteria[1].aliases, [])
  assert.equal(createStableCriterionId('  Reliability & Observability!  '), 'reliability-observability')
})

import { RunnableLambda, RunnableSequence } from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'

const criterionTypeSchema = z.enum(['required', 'preferred'])
const relationshipSchema = z.enum(['equivalent', 'technology', 'related'])

const trimmedString = (minimum, maximum) => z.string().trim().min(minimum).max(maximum)

export const requirementCriterionInputSchema = z.object({
  id: trimmedString(1, 80),
  name: trimmedString(1, 160),
  type: criterionTypeSchema,
  description: trimmedString(1, 2_000),
  aliases: z.array(trimmedString(1, 120)).max(50),
}).strict()

export const requirementIntelligenceInputSchema = z.object({
  mode: z.enum(['enrich', 'replace']),
  roleTitle: trimmedString(1, 160),
  jobDescription: trimmedString(1, 12_000),
  criteria: z.array(requirementCriterionInputSchema).max(30),
}).strict()

export const requirementSuggestionSchema = z.object({
  term: trimmedString(1, 120),
  relationship: relationshipSchema,
  reason: trimmedString(1, 500),
}).strict()

export const requirementProposalCriterionSchema = z.object({
  sourceCriterionId: z.string().trim().min(1).max(80).nullable(),
  id: z.string().trim().min(1).max(80).optional(),
  name: trimmedString(1, 160),
  type: criterionTypeSchema,
  description: trimmedString(1, 2_000),
  suggestions: z.array(requirementSuggestionSchema).max(30),
}).strict()

export const requirementModelOutputSchema = z.object({
  mode: z.enum(['enrich', 'replace']),
  criteria: z.array(requirementProposalCriterionSchema).max(30),
  warnings: z.array(trimmedString(1, 500)).max(30),
}).strict()

export const requirementProposalSchema = requirementModelOutputSchema.extend({
  model: trimmedString(1, 160),
  generatedAt: z.string().datetime(),
}).strict()

const BROAD_TERMS = new Set([
  'api', 'apis', 'backend', 'cloud', 'code', 'coding', 'communication',
  'database', 'databases', 'development', 'devops', 'engineering', 'framework',
  'frontend', 'infrastructure', 'platform', 'programming', 'service', 'services',
  'software', 'system', 'systems', 'technology', 'tool', 'tools', 'web',
])

const cleanText = (value) => value.normalize('NFKC').replace(/\s+/g, ' ').trim()
const canonicalTerm = (value) => cleanText(value).toLocaleLowerCase('en-US')

export function isOverlyBroadRequirementTerm(term) {
  const canonical = canonicalTerm(term)
  return canonical.length < 2 || BROAD_TERMS.has(canonical)
}

/**
 * Treat model output as an untrusted proposal: validate it, retain only mappings
 * to the supplied requisition, and remove terms that would make deterministic
 * matching noisier rather than more accurate.
 */
export function normalizeRequirementProposal(rawProposal, input) {
  const parsedInput = requirementIntelligenceInputSchema.parse(input)
  const parsed = requirementModelOutputSchema.parse(rawProposal)
  const warnings = [...parsed.warnings]
  const knownCriteria = new Map(parsedInput.criteria.map((criterion) => [criterion.id, criterion]))
  const criteria = []

  if (parsed.mode !== parsedInput.mode) {
    warnings.push(`The model returned mode "${parsed.mode}"; "${parsedInput.mode}" was requested.`)
  }

  for (const proposed of parsed.criteria) {
    const source = proposed.sourceCriterionId === null ? null : knownCriteria.get(proposed.sourceCriterionId)
    if (parsedInput.mode === 'enrich' && !source) {
      warnings.push(`Ignored "${proposed.name}" because it did not map to an existing criterion.`)
      continue
    }

    const seen = new Set()
    const existing = new Set(source
      ? [source.name, ...source.aliases].map(canonicalTerm)
      : [])
    const suggestions = []
    for (const suggestion of proposed.suggestions) {
      const term = cleanText(suggestion.term)
      const canonical = canonicalTerm(term)
      if (isOverlyBroadRequirementTerm(term)) {
        warnings.push(`Removed overly broad suggestion "${term}" from "${proposed.name}".`)
        continue
      }
      if (existing.has(canonical)) {
        warnings.push(`Removed suggestion "${term}" because it already exists on "${source.name}".`)
        continue
      }
      if (seen.has(canonical)) {
        warnings.push(`Removed duplicate suggestion "${term}" from "${proposed.name}".`)
        continue
      }
      seen.add(canonical)
      suggestions.push({ ...suggestion, term, reason: cleanText(suggestion.reason) })
    }

    criteria.push({
      ...proposed,
      sourceCriterionId: parsedInput.mode === 'replace' ? null : proposed.sourceCriterionId,
      name: cleanText(proposed.name),
      description: cleanText(proposed.description),
      suggestions,
    })
  }

  return {
    mode: parsedInput.mode,
    criteria,
    warnings: [...new Set(warnings)].slice(0, 30),
  }
}

function modelLabel(model, requestedName) {
  return cleanText(requestedName || model?.modelName || model?.model || 'injected-model')
}

function generationMessages(input) {
  const modeInstruction = input.mode === 'enrich'
    ? 'Map every proposed criterion to an existing criterion ID. Suggest precise aliases or named technologies; do not rewrite the criteria.'
    : 'Propose a complete replacement criteria set. Set every sourceCriterionId to null.'
  return [
    ['system', [
      'You improve hiring-requisition criteria for a human recruiter.',
      modeInstruction,
      'Keep criteria observable and evidence-oriented. Do not infer personal data, compensation, protected traits, or applicant information.',
      'Use relationship "equivalent" for synonymous wording, "technology" for a concrete named technology, and "related" only for contextual review.',
      'Never suggest generic single terms such as software, cloud, platform, engineering, service, system, communication, or technology.',
      'Return only the requested structured output.',
    ].join(' ')],
    ['user', JSON.stringify(input)],
  ]
}

/**
 * Build an injectable LangChain structured-output workflow. A fake chat model
 * only needs to implement withStructuredOutput(schema).invoke(messages, config).
 */
export function createRequirementIntelligenceAgent({
  model,
  apiKey = process.env.OPENAI_API_KEY,
  modelName = process.env.OPENAI_MODEL || 'gpt-4.1-mini',
} = {}) {
  const chatModel = model || new ChatOpenAI({ apiKey, model: modelName, temperature: 0 })
  const structuredModel = chatModel.withStructuredOutput(requirementModelOutputSchema, {
    name: 'requirement_intelligence_proposal',
    strict: true,
  })

  const generate = new RunnableLambda({
    name: 'generate-requirement-proposal',
    func: async (state, config) => ({
      ...state,
      rawProposal: await structuredModel.invoke(generationMessages(state.input), config),
    }),
  })
  const normalize = new RunnableLambda({
    name: 'normalize-requirement-proposal',
    func: async (state) => normalizeRequirementProposal(state.rawProposal, state.input),
  })
  const pipeline = RunnableSequence.from([generate, normalize])

  return {
    async invoke(rawInput, config = {}) {
      // Parsing before prompt construction is the data-minimization boundary:
      // unknown fields cannot be silently forwarded to the model.
      const input = requirementIntelligenceInputSchema.parse(rawInput)
      const normalized = await pipeline.invoke({ input }, config)
      return requirementProposalSchema.parse({
        ...normalized,
        model: modelLabel(chatModel, model ? undefined : modelName),
        generatedAt: new Date().toISOString(),
      })
    },
  }
}

export function generateRequirementProposal(input, options) {
  return createRequirementIntelligenceAgent(options).invoke(input)
}


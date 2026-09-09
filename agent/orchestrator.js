import { RunnableLambda, RunnableSequence } from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import { screenCandidate } from '../src/screening.js'

const now = () => new Date().toISOString()

/**
 * A small, inspectable LangChain workflow. Each node returns the accumulated
 * state, so the UI can show what the agent did and which source it used.
 * The deterministic policy nodes remain the decision authority; an optional
 * LLM is allowed only to write a grounded recruiter summary.
 */
export function createScreeningAgent({ useModel = Boolean(process.env.OPENAI_API_KEY) } = {}) {
  const intake = new RunnableLambda({
    name: 'application-intake',
    func: async (state) => ({ ...state, trace: [...state.trace, {
      step: 'Application intake', status: 'complete', at: now(),
      detail: `${state.candidate.text.split(/\n/).filter(Boolean).length} source lines retained locally.`,
    }] }),
  })

  const evidenceReview = new RunnableLambda({
    name: 'evidence-and-contradiction-review',
    func: async (state) => {
      const assessment = screenCandidate(state.candidate, state.requisition)
      return { ...state, assessment, trace: [...state.trace, {
        step: 'Evidence & contradiction review', status: 'complete', at: now(),
        detail: `${assessment.assessments.length} criteria assessed; ${assessment.flags.length} claim check(s) cited to source text.`,
      }] }
    },
  })

  const decision = new RunnableLambda({
    name: 'decision-policy',
    func: async (state) => {
      const { assessment } = state
      const recommendation = assessment.flags.some((flag) => flag.kind === 'contradictory')
        ? 'Hold for human validation'
        : assessment.requiredStrong >= 3 ? 'Shortlist for recruiter review' : 'Keep in reviewed pool'
      return { ...state, recommendation, trace: [...state.trace, {
        step: 'Human-review decision', status: 'complete', at: now(),
        detail: `${recommendation}. This is a recommendation, not an automated hiring decision.`,
      }] }
    },
  })

  const pipeline = RunnableSequence.from([intake, evidenceReview, decision])

  return {
    async invoke(input) {
      const result = await pipeline.invoke({ ...input, trace: [] })
      let narrative = null
      let modelStatus = 'disabled'
      if (useModel) {
        try {
          const model = new ChatOpenAI({ model: process.env.OPENAI_MODEL || 'gpt-4.1-mini', temperature: 0 })
          const structured = model.withStructuredOutput(z.object({ summary: z.string().max(500) }))
          const response = await structured.invoke([
            ['system', 'Write a concise recruiter summary using only the supplied evidence. Never infer missing experience, do not make a hiring decision, and name material trade-offs.'],
            ['user', JSON.stringify({
              recommendation: result.recommendation,
              strengths: result.assessment.strength,
              tradeoff: result.assessment.tradeoff,
              evidence: result.assessment.assessments.map(({ criterionId, level, evidence }) => ({ criterionId, level, evidence })),
              flags: result.assessment.flags.map(({ kind, assessment }) => ({ kind, assessment })),
            })],
          ])
          narrative = response.summary
          modelStatus = 'grounded-summary-complete'
        } catch (error) {
          modelStatus = `grounded-summary-unavailable: ${error.message}`
        }
      }
      return { ...result, narrative, modelStatus }
    },
  }
}

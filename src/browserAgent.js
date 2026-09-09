import { RunnableLambda, RunnableSequence } from '@langchain/core/runnables'

const timestamp = () => new Date().toISOString()

// Browser-safe LangChain workflow. It uses the already computed, cited
// assessment and never sends application data away from this device.
export function createBrowserScreeningChain() {
  const intake = new RunnableLambda({
    name: 'application-intake',
    func: async (state) => ({ ...state, trace: [...state.trace, {
      step: 'Application intake', status: 'complete', at: timestamp(),
      detail: 'Source application retained in this browser.',
    }] }),
  })
  const evidence = new RunnableLambda({
    name: 'evidence-and-contradiction-review',
    func: async (state) => ({ ...state, trace: [...state.trace, {
      step: 'Evidence & contradiction review', status: 'complete', at: timestamp(),
      detail: `${state.candidate.assessments.length} criteria assessed; ${state.candidate.flags.length} claim check(s) cited to application text.`,
    }] }),
  })
  const policy = new RunnableLambda({
    name: 'human-review-decision',
    func: async (state) => {
      const recommendation = state.candidate.flags.some((flag) => flag.kind === 'contradictory')
        ? 'Hold for human validation'
        : state.candidate.requiredStrong >= 3 ? 'Shortlist for recruiter review' : 'Keep in reviewed pool'
      return { ...state, recommendation, trace: [...state.trace, {
        step: 'Human-review decision', status: 'complete', at: timestamp(),
        detail: `${recommendation}. This is a recommendation, not an automated hiring decision.`,
      }] }
    },
  })
  return RunnableSequence.from([intake, evidence, policy])
}

export async function runBrowserLangChain(candidate) {
  const result = await createBrowserScreeningChain().invoke({ candidate, trace: [] })
  return {
    mode: 'langchain-browser', recommendation: result.recommendation, narrative: null,
    modelStatus: 'LangChain browser workflow completed locally. No resume data left this device.',
    trace: result.trace,
  }
}

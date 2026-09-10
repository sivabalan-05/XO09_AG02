import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { ZodError } from 'zod'
import { createScreeningAgent } from '../agent/orchestrator.js'
import { createRequirementIntelligenceAgent, requirementIntelligenceInputSchema } from '../agent/requirementIntelligence.js'
import { verifyGitHubProfile, verifyLinkedInEvidence, searchGitHubProfiles } from '../agent/verifiers.js'
import { createLinkedInOAuth, oauthCallbackHtml } from './linkedinOAuth.js'

// The Express app itself, with no app.listen() — importable both by the local
// dev entrypoint (server/index.js) and by the Vercel serverless entry
// (api/[...path].js), which calls this same handler per-request instead of
// binding a port.
const app = express()
const linkedinOAuth = createLinkedInOAuth()
const requirementIntelligenceTimeoutMs = 20_000
const requirementIntelligenceRequestLimitBytes = 64 * 1024
app.use(cors())
app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (_req, res) => res.json({
  ok: true,
  service: 'Verity LangChain agent',
  llmSummaryEnabled: Boolean(process.env.OPENAI_API_KEY?.trim()),
  requirementIntelligenceEnabled: Boolean(process.env.OPENAI_API_KEY?.trim()),
}))

app.post('/api/agent/screen', async (req, res) => {
  const { candidate, requisition } = req.body || {}
  if (!candidate?.text || !requisition?.criteria?.length) return res.status(400).json({ error: 'candidate.text and requisition.criteria are required.' })
  try {
    const result = await createScreeningAgent().invoke({ candidate, requisition })
    res.json(result)
  } catch (error) { res.status(500).json({ error: error.message || 'Agent review failed.' }) }
})

app.post('/api/agent/requisition-intelligence', async (req, res) => {
  if (Buffer.byteLength(JSON.stringify(req.body ?? {}), 'utf8') > requirementIntelligenceRequestLimitBytes) {
    return res.status(413).json({ error: 'Requisition intelligence request is too large.' })
  }

  // Keep browser-controlled fields and credentials out of the agent boundary.
  const input = {
    mode: req.body?.mode,
    roleTitle: req.body?.roleTitle,
    jobDescription: req.body?.jobDescription,
    criteria: req.body?.criteria,
  }
  const parsed = requirementIntelligenceInputSchema.safeParse(input)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid requisition intelligence request.',
      fields: [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')).filter(Boolean))],
    })
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return res.status(503).json({ error: 'Requirement intelligence is not configured.' })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), requirementIntelligenceTimeoutMs)
  timeout.unref?.()
  const abortOnDisconnect = () => controller.abort()
  req.once('aborted', abortOnDisconnect)

  try {
    const agent = createRequirementIntelligenceAgent({
      apiKey,
      modelName: process.env.OPENAI_REQUIREMENT_MODEL || process.env.OPENAI_MODEL,
    })
    const result = await agent.invoke(parsed.data, { signal: controller.signal })
    res.set('Cache-Control', 'no-store').json(result)
  } catch (error) {
    if (controller.signal.aborted) {
      return res.status(504).json({ error: 'Requirement intelligence timed out.' })
    }
    if (error instanceof ZodError) {
      return res.status(502).json({ error: 'Requirement intelligence returned an invalid response.' })
    }
    if ([429, 502, 503, 504].includes(Number(error?.status))) {
      return res.status(503).json({ error: 'Requirement intelligence is temporarily unavailable.' })
    }
    if (Number(error?.status) >= 400 && Number(error?.status) < 500) {
      return res.status(502).json({ error: 'Requirement intelligence provider rejected the request.' })
    }
    return res.status(500).json({ error: 'Requirement intelligence failed.' })
  } finally {
    clearTimeout(timeout)
    req.off('aborted', abortOnDisconnect)
  }
})

app.post('/api/verify/github', async (req, res) => {
  try { res.json(await verifyGitHubProfile(req.body?.profileUrl, req.body?.requisition)) }
  catch { res.status(502).json({ status: 'unavailable', provider: 'GitHub', message: 'GitHub could not be reached. No verification result was created.' }) }
})

app.post('/api/verify/linkedin', (req, res) => res.json(verifyLinkedInEvidence(req.body || {})))

app.get('/api/auth/linkedin/status', (_req, res) => res.json(linkedinOAuth.status()))

app.get('/api/auth/linkedin/start', (req, res) => {
  try { res.json(linkedinOAuth.createAuthorizationUrl(req.query.candidateId)) }
  catch (error) { res.status(error.status || 500).json({ error: error.message || 'Could not start LinkedIn authorization.' }) }
})

app.get('/api/auth/linkedin/callback', async (req, res) => {
  try {
    const result = await linkedinOAuth.completeAuthorization(req.query)
    res.type('html').send(oauthCallbackHtml(result))
  } catch (error) {
    const fallbackOrigin = process.env.APP_ORIGIN || 'http://127.0.0.1:5175'
    res.status(error.status || 500).type('html').send(oauthCallbackHtml({ frontendOrigin: fallbackOrigin, candidateId: error.candidateId || '', error: error.message || 'LinkedIn authorization failed.' }))
  }
})

app.post('/api/verify/github/search', async (req, res) => {
  try { res.json({ results: await searchGitHubProfiles(req.body?.name) }) }
  catch (error) { res.status(502).json({ results: [], message: error.message || 'GitHub search unavailable.' }) }
})

export default app

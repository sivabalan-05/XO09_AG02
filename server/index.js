import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { createScreeningAgent } from '../agent/orchestrator.js'
import { verifyGitHubProfile, verifyLinkedInEvidence, searchGitHubProfiles } from '../agent/verifiers.js'

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'Verity LangChain agent', llmSummaryEnabled: Boolean(process.env.OPENAI_API_KEY) }))

app.post('/api/agent/screen', async (req, res) => {
  const { candidate, requisition } = req.body || {}
  if (!candidate?.text || !requisition?.criteria?.length) return res.status(400).json({ error: 'candidate.text and requisition.criteria are required.' })
  try {
    const result = await createScreeningAgent().invoke({ candidate, requisition })
    res.json(result)
  } catch (error) { res.status(500).json({ error: error.message || 'Agent review failed.' }) }
})

app.post('/api/verify/github', async (req, res) => {
  try { res.json(await verifyGitHubProfile(req.body?.profileUrl, req.body?.requisition)) }
  catch { res.status(502).json({ status: 'unavailable', provider: 'GitHub', message: 'GitHub could not be reached. No verification result was created.' }) }
})

app.post('/api/verify/linkedin', (req, res) => res.json(verifyLinkedInEvidence(req.body || {})))

app.post('/api/verify/github/search', async (req, res) => {
  try { res.json({ results: await searchGitHubProfiles(req.body?.name) }) }
  catch (error) { res.status(502).json({ results: [], message: error.message || 'GitHub search unavailable.' }) }
})

const port = Number(process.env.AGENT_PORT || 8787)
app.listen(port, () => console.log(`Verity agent API listening on http://127.0.0.1:${port}`))

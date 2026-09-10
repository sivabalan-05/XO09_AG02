import { randomBytes } from 'node:crypto'

const BASIC_SCOPES = ['openid', 'profile', 'email']
const AUTHORIZATION_ENDPOINT = 'https://www.linkedin.com/oauth/v2/authorization'
const TOKEN_ENDPOINT = 'https://www.linkedin.com/oauth/v2/accessToken'
const USERINFO_ENDPOINT = 'https://api.linkedin.com/v2/userinfo'

function oauthError(message, status = 400) {
  const error = new Error(message)
  error.status = status
  return error
}

function readConfig(env) {
  const scopes = (env.LINKEDIN_SCOPES || BASIC_SCOPES.join(' ')).split(/[\s,]+/).filter(Boolean)
  return {
    clientId: env.LINKEDIN_CLIENT_ID || '',
    clientSecret: env.LINKEDIN_CLIENT_SECRET || '',
    redirectUri: env.LINKEDIN_REDIRECT_URI || '',
    frontendOrigin: env.APP_ORIGIN || 'http://127.0.0.1:5175',
    scopes,
  }
}

export function createLinkedInOAuth({ env = process.env, fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  const config = readConfig(env)
  const pendingStates = new Map()
  const configured = Boolean(config.clientId && config.clientSecret && config.redirectUri)
  const status = () => ({
    configured,
    provider: 'LinkedIn',
    mode: 'openid-connect',
    scopes: config.scopes,
    capabilities: { accountConnection: configured, basicProfile: configured, experience: false, skills: false },
    message: configured
      ? 'LinkedIn OAuth is configured. Standard OpenID Connect returns basic profile data only; employment and skills require separately approved LinkedIn products and scopes.'
      : 'LinkedIn OAuth needs LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, and LINKEDIN_REDIRECT_URI on the server.',
  })

  function createAuthorizationUrl(candidateId = '') {
    if (!configured) throw oauthError(status().message, 503)
    const cleanCandidateId = String(candidateId).trim().slice(0, 80)
    if (!cleanCandidateId) throw oauthError('candidateId is required.')
    const state = randomBytes(32).toString('base64url')
    pendingStates.set(state, { candidateId: cleanCandidateId, expiresAt: now() + 10 * 60 * 1000 })
    for (const [key, value] of pendingStates) if (value.expiresAt <= now()) pendingStates.delete(key)
    const url = new URL(AUTHORIZATION_ENDPOINT)
    url.search = new URLSearchParams({ response_type: 'code', client_id: config.clientId, redirect_uri: config.redirectUri, state, scope: config.scopes.join(' ') }).toString()
    return { authorizationUrl: url.toString(), stateExpiresInSeconds: 600 }
  }

  async function completeAuthorization({ code = '', state = '', error = '', error_description: description = '' } = {}) {
    const pending = pendingStates.get(state)
    pendingStates.delete(state)
    if (!pending || pending.expiresAt <= now()) throw oauthError('LinkedIn connection state is invalid or expired.', 401)
    const failForCandidate = (message, statusCode = 400) => {
      const failure = oauthError(message, statusCode)
      failure.candidateId = pending.candidateId
      throw failure
    }
    if (error) failForCandidate(description || `LinkedIn authorization failed: ${error}`)
    if (!code) failForCandidate('LinkedIn did not return an authorization code.')
    const tokenResponse = await fetchImpl(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri }),
      signal: AbortSignal.timeout(10000),
    })
    const tokenBody = await tokenResponse.json().catch(() => ({}))
    if (!tokenResponse.ok || !tokenBody.access_token) failForCandidate(tokenBody.error_description || 'LinkedIn token exchange failed.', 502)
    const profileResponse = await fetchImpl(USERINFO_ENDPOINT, { headers: { Authorization: `Bearer ${tokenBody.access_token}` }, signal: AbortSignal.timeout(10000) })
    const profile = await profileResponse.json().catch(() => ({}))
    if (!profileResponse.ok || !profile.sub) failForCandidate('LinkedIn basic profile request failed.', 502)
    return {
      candidateId: pending.candidateId,
      frontendOrigin: config.frontendOrigin,
      verification: {
        status: 'identity-connected', provider: 'LinkedIn', checkedAt: new Date(now()).toISOString(),
        oauthProfile: { subject: profile.sub, name: profile.name || [profile.given_name, profile.family_name].filter(Boolean).join(' '), picture: profile.picture || '', locale: profile.locale || '' },
        capabilities: { accountConnection: true, basicProfile: true, experience: false, skills: false },
        criteriaSignals: [],
        message: 'LinkedIn account connected. Standard OpenID Connect supplied basic profile data, but no employment history or skills.',
        disclaimer: 'LinkedIn OpenID Connect does not verify identity and does not provide employment or skill evidence. Do not treat this connection as a background check.',
      },
    }
  }

  return { status, createAuthorizationUrl, completeAuthorization }
}

export function oauthCallbackHtml({ frontendOrigin, candidateId, verification, error }) {
  const payload = JSON.stringify({ type: 'verity:linkedin-oauth', candidateId, ok: !error, verification, error: error || '' }).replaceAll('<', '\\u003c')
  const target = JSON.stringify(frontendOrigin).replaceAll('<', '\\u003c')
  return `<!doctype html><html><head><meta charset="utf-8"><title>LinkedIn connection</title></head><body><p>Returning to Verity…</p><script>window.opener?.postMessage(${payload},${target});window.close();</script></body></html>`
}

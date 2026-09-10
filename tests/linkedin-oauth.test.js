import test from 'node:test'
import assert from 'node:assert/strict'
import { createLinkedInOAuth, oauthCallbackHtml } from '../server/linkedinOAuth.js'

const env = {
  LINKEDIN_CLIENT_ID: 'client-id', LINKEDIN_CLIENT_SECRET: 'server-secret',
  LINKEDIN_REDIRECT_URI: 'https://example.test/api/auth/linkedin/callback',
  APP_ORIGIN: 'https://app.example.test',
}

test('LinkedIn OAuth status is honest about standard OIDC capabilities', () => {
  const oauth = createLinkedInOAuth({ env })
  assert.equal(oauth.status().configured, true)
  assert.equal(oauth.status().capabilities.basicProfile, true)
  assert.equal(oauth.status().capabilities.experience, false)
  assert.equal(oauth.status().capabilities.skills, false)
})

test('LinkedIn authorization URL uses exact callback, minimum scopes, and CSRF state', () => {
  const oauth = createLinkedInOAuth({ env })
  const { authorizationUrl } = oauth.createAuthorizationUrl('A-01')
  const url = new URL(authorizationUrl)
  assert.equal(url.origin + url.pathname, 'https://www.linkedin.com/oauth/v2/authorization')
  assert.equal(url.searchParams.get('redirect_uri'), env.LINKEDIN_REDIRECT_URI)
  assert.equal(url.searchParams.get('scope'), 'openid profile email')
  assert.ok(url.searchParams.get('state').length >= 40)
  assert.equal(authorizationUrl.includes('server-secret'), false)
})

test('LinkedIn callback exchanges the code server-side and never returns the access token', async () => {
  const requests = []
  const fetchImpl = async (url, options) => {
    requests.push({ url, options })
    if (String(url).includes('accessToken')) return { ok: true, json: async () => ({ access_token: 'private-token' }) }
    return { ok: true, json: async () => ({ sub: 'member-123', name: 'Sam Candidate', email: 'sam@example.test', email_verified: true }) }
  }
  const oauth = createLinkedInOAuth({ env, fetchImpl, now: () => Date.parse('2026-09-10T00:00:00Z') })
  const { authorizationUrl } = oauth.createAuthorizationUrl('A-01')
  const result = await oauth.completeAuthorization({ code: 'auth-code', state: new URL(authorizationUrl).searchParams.get('state') })
  assert.equal(result.candidateId, 'A-01')
  assert.equal(result.verification.oauthProfile.name, 'Sam Candidate')
  assert.equal(result.verification.capabilities.experience, false)
  assert.equal(JSON.stringify(result).includes('private-token'), false)
  assert.match(requests[1].options.headers.Authorization, /private-token/)
})

test('LinkedIn callback state is single-use', async () => {
  const fetchImpl = async (url) => String(url).includes('accessToken') ? { ok: true, json: async () => ({ access_token: 'token' }) } : { ok: true, json: async () => ({ sub: 'member' }) }
  const oauth = createLinkedInOAuth({ env, fetchImpl })
  const { authorizationUrl } = oauth.createAuthorizationUrl('A-01')
  const state = new URL(authorizationUrl).searchParams.get('state')
  await oauth.completeAuthorization({ code: 'one', state })
  await assert.rejects(() => oauth.completeAuthorization({ code: 'two', state }), /invalid or expired/i)
})

test('OAuth callback HTML only posts sanitized data to the configured app origin', () => {
  const html = oauthCallbackHtml({ frontendOrigin: 'https://app.example.test', candidateId: 'A-01', verification: { name: '</script><script>alert(1)</script>' } })
  assert.match(html, /postMessage/)
  assert.match(html, /https:\/\/app\.example\.test/)
  assert.equal(html.includes('</script><script>alert(1)</script>'), false)
})

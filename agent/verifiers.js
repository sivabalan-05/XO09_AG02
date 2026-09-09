import { containsTerm } from '../src/contradictions.js'

const githubHandle = (value = '') => {
  const clean = value.trim().replace(/\/$/, '')
  const match = clean.match(/(?:github\.com\/)?([A-Za-z0-9-]{1,39})$/i)
  return match?.[1] || null
}

function criterionSignals(text, criteria = []) {
  return criteria.flatMap((criterion) => {
    const terms = criterion.aliases.filter((term) => containsTerm(text, term))
    return terms.length ? [{ criterionId: criterion.id, criterion: criterion.name, terms }] : []
  })
}

export async function verifyGitHubProfile(profileUrl, requisition = {}) {
  const handle = githubHandle(profileUrl)
  if (!handle) return { status: 'needs-input', provider: 'GitHub', message: 'Enter a public GitHub profile URL or handle.' }
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'Verity-Hire-Hackathon-Demo' }
  const profileResponse = await fetch(`https://api.github.com/users/${encodeURIComponent(handle)}`, { headers })
  if (!profileResponse.ok) return { status: 'unavailable', provider: 'GitHub', message: profileResponse.status === 404 ? 'No public GitHub profile was found for that handle.' : `GitHub returned ${profileResponse.status}. Try again later.` }
  const [profile, reposResponse] = await Promise.all([
    profileResponse.json(),
    fetch(`https://api.github.com/users/${encodeURIComponent(handle)}/repos?sort=updated&per_page=12`, { headers }),
  ])
  const repos = reposResponse.ok ? await reposResponse.json() : []
  const evidence = repos.filter((repo) => !repo.fork).slice(0, 8).map((repo) => ({
    name: repo.name, url: repo.html_url, description: repo.description || 'No repository description supplied.',
    language: repo.language || 'Not declared', topics: repo.topics || [], updatedAt: repo.updated_at,
  }))
  const criteriaSignals = evidence.flatMap((repo) => criterionSignals(`${repo.name}\n${repo.description}\n${repo.language}\n${repo.topics.join(' ')}`, requisition.criteria))
  return {
    status: 'review-ready', provider: 'GitHub', checkedAt: new Date().toISOString(),
    profile: { handle: profile.login, url: profile.html_url, publicRepos: profile.public_repos, name: profile.name || profile.login },
    evidence,
    criteriaSignals,
    disclaimer: 'Public repository metadata is independent evidence for a recruiter to review. It does not prove employment, authorship, proficiency, or identity.',
  }
}

export function verifyLinkedInEvidence({ url = '', authorizedText = '', requisition = {} }) {
  if (!url.trim() && !authorizedText.trim()) return { status: 'needs-consent', provider: 'LinkedIn', message: 'Ask the candidate to provide a public link and an authorized profile export or connect via an approved LinkedIn partner integration.' }
  if (!authorizedText.trim()) return { status: 'needs-authorized-export', provider: 'LinkedIn', url, message: 'A URL alone is not scraped. Paste a candidate-authorized profile export to compare it with their application.' }
  const lines = authorizedText.split('\n').map((line) => line.trim()).filter((line) => line.length > 12).slice(0, 20)
  return {
    status: 'review-ready', provider: 'LinkedIn', checkedAt: new Date().toISOString(), url,
    evidence: lines,
    criteriaSignals: criterionSignals(authorizedText, requisition.criteria),
    disclaimer: 'This compares candidate-provided, authorized text only. It is not a LinkedIn identity verification or an employment background check.',
  }
}

import { containsTerm } from '../src/contradictions.js'
import { analyzeExperienceText } from '../src/candidateFacts.js'

// Paths that look like a handle but are GitHub site sections, not a profile.
const githubReservedPaths = new Set(['settings', 'about', 'features', 'topics', 'search', 'marketplace', 'sponsors', 'notifications', 'issues', 'pulls', 'explore', 'collections', 'trending', 'events', 'orgs', 'apps', 'contact', 'pricing', 'security', 'join', 'login', 'signup', 'dashboard', 'site'])

// Looks for a github.com/<handle> reference already written in the resume text
// itself, so the recruiter never has to retype a link the candidate already gave.
export function extractGithubUrl(text = '') {
  const match = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38})?)\b/i)
  if (!match) return null
  const handle = match[1]
  if (githubReservedPaths.has(handle.toLowerCase())) return null
  return `https://github.com/${handle}`
}

// Looks for a linkedin.com/in/<slug> reference already written in the resume text.
export function extractLinkedInUrl(text = '') {
  const match = text.match(/(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([A-Za-z0-9\-_%]{2,100})\b/i)
  if (!match) return null
  return `https://www.linkedin.com/in/${match[1]}`
}

// Fallback when the resume has no GitHub link: search public profiles by the
// candidate's name (as entered by the recruiter) so they can confirm a match
// themselves. This never auto-selects a profile — identity is never inferred
// without a human reviewing it, matching the recruiter safeguard shown in the
// verification panel.
export async function searchGitHubProfiles(name, { limit = 5 } = {}) {
  const query = (name || '').trim()
  if (!query) return []
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'Verity-Hire-Hackathon-Demo' }
  const signal = AbortSignal.timeout(8000)
  const response = await fetch(`https://api.github.com/search/users?q=${encodeURIComponent(query)}+in:fullname&per_page=${limit}`, { headers, signal })
  if (response.status === 403) throw new Error('GitHub search rate limit reached. Try again later, or enter the profile URL directly.')
  if (!response.ok) throw new Error(`GitHub search returned ${response.status}. Try again later.`)
  const data = await response.json()
  return (data.items || []).map((item) => ({ login: item.login, url: item.html_url, avatarUrl: item.avatar_url }))
}

const githubHandle = (value = '') => {
  const clean = value.trim()
  if (/^[A-Za-z0-9-]{1,39}$/.test(clean)) return clean
  try {
    const url = new URL(clean.startsWith('http') ? clean : `https://${clean}`)
    if (!['github.com', 'www.github.com'].includes(url.hostname.toLowerCase())) return null
    const handle = url.pathname.split('/').filter(Boolean)[0]
    return handle && /^[A-Za-z0-9-]{1,39}$/.test(handle) ? handle : null
  } catch { return null }
}

function criterionSignals(text, criteria = []) {
  return criteria.flatMap((criterion) => {
    const terms = (criterion.aliases || []).filter((term) => containsTerm(text, term))
    return terms.length ? [{ criterionId: criterion.id, criterion: criterion.name, terms }] : []
  })
}

export async function verifyGitHubProfile(profileUrl, requisition = {}) {
  const handle = githubHandle(profileUrl)
  if (!handle) return { status: 'needs-input', provider: 'GitHub', message: 'Enter a public GitHub profile URL or handle.' }
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'Verity-Hire-Hackathon-Demo' }
  const signal = AbortSignal.timeout(8000)
  const profileResponse = await fetch(`https://api.github.com/users/${encodeURIComponent(handle)}`, { headers, signal })
  if (!profileResponse.ok) return { status: 'unavailable', provider: 'GitHub', message: profileResponse.status === 404 ? 'No public GitHub profile was found for that handle.' : `GitHub returned ${profileResponse.status}. Try again later.` }
  const [profile, reposResponse] = await Promise.all([
    profileResponse.json(),
    fetch(`https://api.github.com/users/${encodeURIComponent(handle)}/repos?sort=updated&per_page=12`, { headers, signal }),
  ])
  const repos = reposResponse.ok ? await reposResponse.json() : []
  const evidence = repos.filter((repo) => !repo.fork).slice(0, 8).map((repo) => ({
    name: repo.name, url: repo.html_url, description: repo.description || 'No repository description supplied.',
    language: repo.language || 'Not declared', topics: repo.topics || [], createdAt: repo.created_at, pushedAt: repo.pushed_at, updatedAt: repo.updated_at,
  }))
  const activityDates = evidence.flatMap((repo) => [repo.createdAt, repo.pushedAt || repo.updatedAt]).filter(Boolean).map((value) => new Date(value)).filter((value) => !Number.isNaN(value.getTime()))
  const firstActivity = activityDates.length ? new Date(Math.min(...activityDates)) : null
  const lastActivity = activityDates.length ? new Date(Math.max(...activityDates)) : null
  const activity = firstActivity && lastActivity ? {
    firstObservedAt: firstActivity.toISOString(), lastObservedAt: lastActivity.toISOString(),
    spanYears: Math.round(((lastActivity - firstActivity) / (365.25 * 24 * 60 * 60 * 1000)) * 10) / 10,
    repositoryCount: evidence.length,
    label: 'Observable activity across the sampled public repositories',
  } : null
  const criteriaSignals = evidence.flatMap((repo) => criterionSignals(`${repo.name}\n${repo.description}\n${repo.language}\n${repo.topics.join(' ')}`, requisition.criteria)
    .map((signal) => ({ ...signal, source: 'GitHub', repo: repo.name, repoUrl: repo.url })))
  return {
    status: 'review-ready', provider: 'GitHub', checkedAt: new Date().toISOString(),
    profile: { handle: profile.login, url: profile.html_url, publicRepos: profile.public_repos, name: profile.name || profile.login, createdAt: profile.created_at },
    evidence, activity,
    criteriaSignals,
    disclaimer: 'Public repository metadata is independent evidence for a recruiter to review. It does not prove employment, authorship, proficiency, or identity.',
  }
}

export function verifyLinkedInEvidence({ url = '', authorizedText = '', requisition = {} }) {
  if (!url.trim() && !authorizedText.trim()) return { status: 'needs-consent', provider: 'LinkedIn', message: 'Ask the candidate to provide a public link and an authorized profile export or connect via an approved LinkedIn partner integration.' }
  if (!authorizedText.trim()) return { status: 'needs-authorized-export', provider: 'LinkedIn', url, message: 'A URL alone is not scraped. Paste a candidate-authorized profile export to compare it with their application.' }
  const lines = authorizedText.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 20)
  return {
    status: 'review-ready', provider: 'LinkedIn', checkedAt: new Date().toISOString(), url,
    evidence: lines, experience: analyzeExperienceText(authorizedText),
    criteriaSignals: criterionSignals(authorizedText, requisition.criteria).map((signal) => ({ ...signal, source: 'LinkedIn' })),
    disclaimer: 'This compares candidate-provided, authorized text only. It is not a LinkedIn identity verification or an employment background check.',
  }
}

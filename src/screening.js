import { detectContradictions, containsTerm } from './contradictions.js'

const claimWords = /\b(expert|world[- ]class|advanced|master(?:y|ed)?|highly skilled|proficient|strong|extensive|deep expertise|specialist)\b/i
const evidenceWords = /\b(built|developed|implemented|deployed|operated|created|introduced|improved|reduced|increased|migrated|designed|owned|led|supported|configured|resolved|shipped|wrote|authored|partnered|tested|processed|handling|used|added|assisted|participated|maintained)\b/i
const quantified = /\b\d+(?:[.,]\d+)?(?:k|m|%|ms|s| minutes?| hours?| days?| services?| users?| events?| requests?| incidents?| regions?| nodes?)\b/i
const productionWords = /\b(production|customer|enterprise|on-call|incident|sla|uptime|live|monthly users|per day)\b/i
const caveatWords = /\b(no |not |haven't|have not|did not|without|only read|course|coursework|toy|sample|guided|shadow|assisted|academic|simulated|personal project)\b/i

function meetsTenKRequestScale(text) {
  const matches = [...text.matchAll(/\b(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?k)\s*(?:rps|requests?\s+(?:per\s+)?(?:second|sec))\b/ig)]
  return matches.some((match) => {
    const raw = match[1].toLowerCase()
    const value = raw.endsWith('k') ? Number(raw.slice(0, -1)) * 1000 : Number(raw.replaceAll(',', ''))
    return value >= 10000
  })
}

export function splitEvidence(text) {
  return text
    .split(/\n|(?<=[.!?])\s+/)
    .map((line) => line.replace(/^[•\-*]\s*/, '').trim())
    .filter((line) => line.length > 15)
}

function hitsFor(line, aliases) {
  return aliases.filter((alias) => containsTerm(line, alias))
}

function assessCriterion(text, criterion) {
  const lines = splitEvidence(text)
  const matched = lines
    .map((line) => ({ line, aliases: hitsFor(line, criterion.aliases || []) }))
    .filter((item) => item.aliases.length)

  if (!matched.length) {
    return {
      criterionId: criterion.id,
      level: 'not-addressed',
      // There is no evidence to be confident in. Absence certainty belongs in
      // the explanation, not in an evidence-confidence bar shown to recruiters.
      confidence: 0,
      evidence: [],
      terms: [],
      reason: 'No relevant claim or supporting example found in the application.',
    }
  }

  const scored = matched.map((item) => {
    const isClaim = claimWords.test(item.line)
    const action = evidenceWords.test(item.line)
    const metric = quantified.test(item.line)
    const production = productionWords.test(item.line)
    const caveat = caveatWords.test(item.line)
    let score = 1
    if (action) score += 2
    if (metric) score += 2
    if (production) score += 1
    if (caveat) score -= 2
    if (isClaim && !action && !metric) score -= 1
    return { ...item, score, isClaim, action, metric, production, caveat }
  }).sort((a, b) => b.score - a.score)

  const best = scored[0]
  const hasUnsupportedClaim = scored.some((x) => x.isClaim && !x.action && !x.metric)
  const actionExamples = scored.filter((x) => x.action && !x.caveat)
  const productionExamples = actionExamples.filter((x) => x.production)
  const metricExamples = actionExamples.filter((x) => x.metric)
  let level = 'emerging'
  let confidence = 58

  if (best.score >= 5 && productionExamples.length) {
    level = 'strong'
    confidence = Math.min(96, 78 + productionExamples.length * 4 + metricExamples.length * 3)
  } else if (best.score >= 3 && actionExamples.length) {
    level = 'supported'
    confidence = Math.min(88, 66 + actionExamples.length * 4 + metricExamples.length * 3)
  } else if (hasUnsupportedClaim) {
    level = 'claim-only'
    confidence = 38
  }

  if (criterion.id === 'multiregion') {
    const scaleMet = meetsTenKRequestScale(text)
    const leadMet = /\b(led|owned|architected)\b/i.test(matched.map((x) => x.line).join(' '))
    const prodMet = matched.some((x) => productionWords.test(x.line))
    if (!(scaleMet && leadMet && prodMet)) {
      level = best.score >= 3 ? 'partial' : hasUnsupportedClaim ? 'claim-only' : 'emerging'
      confidence = 82
    }
  }

  const reasonMap = {
    strong: 'Direct, outcome-oriented evidence in a real operating context.',
    supported: 'Relevant hands-on evidence is present, though scope or outcomes are limited.',
    emerging: 'Terminology is present, but evidence is indirect, academic, or introductory.',
    partial: 'Related experience is present, but the stated ownership, scale, or production bar is not met.',
    'claim-only': 'The application makes a skill claim without a concrete work or project example.',
  }

  return {
    criterionId: criterion.id,
    level,
    confidence,
    evidence: scored.slice(0, 2).map((x) => x.line),
    terms: [...new Set(scored.flatMap((x) => x.aliases))].slice(0, 5),
    hasUnsupportedClaim,
    reason: reasonMap[level],
  }
}

const levelValue = { strong: 4, supported: 3, partial: 2, emerging: 1, 'claim-only': 1, conflicting: 0, 'not-addressed': 0 }

// Cross-check step: a verified GitHub repo (or an authorized LinkedIn export)
// touching the same skill area is real, independent evidence — but a repo
// existing is weaker proof than a demonstrated, production-context resume
// bullet, so it can only nudge a criterion up one step and never past
// "supported" on its own, and it never overrides a contradiction.
const corroborationLadder = ['not-addressed', 'claim-only', 'emerging', 'partial', 'supported', 'strong']
const corroborationCeiling = corroborationLadder.indexOf('supported')

function externalSignalsByCriterion(verification) {
  const signals = [...(verification?.github?.criteriaSignals || []), ...(verification?.linkedin?.criteriaSignals || [])]
  const byCriterion = new Map()
  for (const signal of signals) {
    if (!byCriterion.has(signal.criterionId)) byCriterion.set(signal.criterionId, [])
    byCriterion.get(signal.criterionId).push(signal)
  }
  return byCriterion
}

function applyExternalCorroboration(assessments, verification) {
  const signalsByCriterion = externalSignalsByCriterion(verification)
  if (!signalsByCriterion.size) return assessments
  return assessments.map((assessment) => {
    const signals = signalsByCriterion.get(assessment.criterionId)
    if (!signals?.length || assessment.level === 'conflicting') return assessment
    const currentIndex = corroborationLadder.indexOf(assessment.level)
    const level = currentIndex >= 0 && currentIndex < corroborationCeiling ? corroborationLadder[currentIndex + 1] : assessment.level
    const confidence = Math.max(assessment.confidence, Math.min(80, assessment.confidence + 10))
    const repos = [...new Set(signals.filter((s) => s.repo).map((s) => s.repo))]
    const linkedinOnly = signals.every((s) => s.source === 'LinkedIn')
    const note = repos.length
      ? `Cross-checked: GitHub repositor${repos.length === 1 ? 'y' : 'ies'} (${repos.join(', ')}) reference${repos.length === 1 ? 's' : ''} this area.`
      : linkedinOnly ? 'Cross-checked: the authorized LinkedIn export references this area.' : 'Cross-checked against external evidence for this area.'
    return {
      ...assessment,
      level,
      confidence,
      externalCorroboration: signals.map(({ source, repo, repoUrl, terms }) => ({ source, repo, repoUrl, terms })),
      reason: `${assessment.reason} ${note}`,
    }
  })
}

function getTradeoffs(assessments, requisition) {
  const strong = assessments.filter((a) => ['strong', 'supported'].includes(a.level))
    .map((a) => requisition.criteria.find((c) => c.id === a.criterionId)?.name)
  const gaps = assessments.filter((a) => ['partial', 'emerging', 'claim-only', 'not-addressed'].includes(a.level))
    .map((a) => requisition.criteria.find((c) => c.id === a.criterionId)?.name)
  return {
    strength: strong.length ? strong.slice(0, 2).join(' + ') : 'No criterion is strongly evidenced yet',
    tradeoff: gaps.length ? `${gaps[0]} needs validation` : 'No material evidence gap detected',
  }
}

export function screenCandidate(candidate, requisition) {
  const flags = detectContradictions(candidate.text, requisition)
  const resumeAssessments = requisition.criteria.map((criterion) => {
    const assessment = assessCriterion(candidate.text, criterion)
    const relevantFlags = flags.filter((flag) => flag.criteriaIds.includes(criterion.id))
    if (!relevantFlags.length) return { ...assessment, criterionType: criterion.type, flags: [], originalConfidence: assessment.confidence }
    const conflict = relevantFlags.some((flag) => flag.kind === 'contradictory')
    return {
      ...assessment, criterionType: criterion.type, flags: relevantFlags, originalConfidence: assessment.confidence,
      confidence: Math.max(0, Math.min(assessment.confidence - 15, ...relevantFlags.map((flag) => flag.confidenceCap))),
      level: conflict ? 'conflicting' : assessment.level === 'strong' ? 'supported' : assessment.level,
      hasUnsupportedClaim: true,
      reason: conflict ? 'Conflicting source passages leave this criterion unresolved. Review the cited claims before relying on it.' : `${assessment.reason} The flagged claim remains unverified; confidence is reduced.`,
    }
  })
  const assessments = applyExternalCorroboration(resumeAssessments, candidate.verification)
  const required = assessments.filter((a) => requisition.criteria.find((c) => c.id === a.criterionId)?.type === 'required')
  const requiredStrong = required.filter((a) => ['strong', 'supported'].includes(a.level)).length
  const requiredPartial = required.filter((a) => ['partial', 'emerging'].includes(a.level)).length
  const unsupportedClaims = assessments.filter((a) => a.hasUnsupportedClaim)
  const evidencePoints = assessments.reduce((sum, a) => sum + levelValue[a.level], 0)
  const maxPoints = assessments.length * 4
  // Confidence that a criterion is absent must not inflate confidence in candidate claims.
  const addressed = assessments.filter((a) => a.level !== 'not-addressed')
  const unadjustedConfidence = Math.round(
    addressed.reduce((sum, a) => sum + a.originalConfidence, 0) / (addressed.length || 1),
  )
  const confidence = Math.max(0, Math.round(
    addressed.reduce((sum, a) => sum + a.confidence, 0) / (addressed.length || 1),
  ) - Math.min(20, flags.filter((flag) => !flag.criteriaIds.length).length * 5))
  let band = 'Developing match'
  if (requiredStrong >= 4 && unsupportedClaims.length === 0 && flags.length === 0) band = 'Leading match'
  else if (requiredStrong >= 3) band = 'Strong match'
  else if (requiredStrong >= 2 || requiredStrong + requiredPartial >= 4) band = 'Promising match'

  return {
    ...candidate,
    assessments,
    flags,
    unadjustedConfidence,
    confidenceReduction: Math.max(0, unadjustedConfidence - confidence),
    contradictionCount: flags.filter((flag) => flag.kind === 'contradictory').length,
    requiredStrong,
    requiredTotal: required.length,
    unsupportedCount: unsupportedClaims.length,
    evidenceCoverage: maxPoints ? Math.round((evidencePoints / maxPoints) * 100) : 0,
    confidence,
    band,
    ...getTradeoffs(assessments, requisition),
    ...(flags.length ? { tradeoff: `${flags.length} claim check${flags.length === 1 ? ' requires' : 's require'} validation: ${[...new Set(flags.map((f) => f.rule.replaceAll('-', ' ')))].join(', ')}` } : {}),
  }
}

export function screenPool(candidates, requisition) {
  const screened = candidates.map((candidate) => screenCandidate(candidate, requisition))
  const bandOrder = { 'Leading match': 4, 'Strong match': 3, 'Promising match': 2, 'Developing match': 1 }
  return screened.sort((a, b) =>
    bandOrder[b.band] - bandOrder[a.band]
    || b.requiredStrong - a.requiredStrong
    || b.evidenceCoverage - a.evidenceCoverage,
  )
}

export function getPoolInsights(screened, requisition) {
  return requisition.criteria.map((criterion) => {
    const assessments = screened.map((candidate) => candidate.assessments.find((a) => a.criterionId === criterion.id))
    const strong = assessments.filter((a) => ['strong', 'supported'].includes(a.level)).length
    const partial = assessments.filter((a) => ['partial', 'emerging'].includes(a.level)).length
    const claimOnly = assessments.filter((a) => a.level === 'claim-only').length
    const coverage = screened.length ? Math.round((strong / screened.length) * 100) : 0
    return { ...criterion, strong, partial, claimOnly, coverage, isGap: criterion.type === 'required' && strong === 0 }
  })
}

export const levelLabels = {
  conflicting: 'Conflicting evidence',
  strong: 'Strong evidence',
  supported: 'Supported',
  partial: 'Partially met',
  emerging: 'Emerging',
  'claim-only': 'Claim only',
  'not-addressed': 'Not addressed',
}

import { sourcePassages } from './contradictions.js'

const workSection = /experience|employment|work|project|research|internship/i
const excludedSection = /education|skills|certification/i
const action = /\b(built|building|developed|implemented|deployed|operated|created|led|owned|wrote|maintained|designed|shipped|supported|introduced|managed|delivered|facilitated|configured|improved|authored|worked)\b/i
const wordNumbers = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 }

const rounded = (value) => Math.round(value * 10) / 10

function durationFromPassage(passage) {
  if (excludedSection.test(passage.section)) return null
  const years = passage.quote.match(/\b(\d+(?:\.\d+)?)\+?\s+years?(?:\s+of)?(?:\s+(?:professional|industry|software|platform|relevant))?\s*(?:experience)?\b/i)
    || passage.quote.match(/(?:—|-)\s*(\d+(?:\.\d+)?)\+?\s+years?\b/i)
  if (years) return Number(years[1])
  const months = passage.quote.match(/\b(\d+(?:\.\d+)?)\s*[- ]?months?\b/i)
  if (months) return rounded(Number(months[1]) / 12)
  const wordMonths = passage.quote.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*[- ]months?\b/i)
  return wordMonths ? rounded(wordNumbers[wordMonths[1].toLowerCase()] / 12) : null
}

function mergeYears(ranges) {
  const merged = []
  for (const range of ranges.sort((a, b) => a[0] - b[0])) {
    const last = merged.at(-1)
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1])
    else merged.push([...range])
  }
  return rounded(merged.reduce((total, [start, end]) => total + Math.max(0, end - start), 0))
}

export function analyzeExperienceText(text = '', now = new Date()) {
  const passages = sourcePassages(text)
  const claims = passages.flatMap((passage) => {
    const years = durationFromPassage(passage)
    return years === null ? [] : [{ ...passage, years }]
  })
  const supportingPassages = passages.filter((passage) => workSection.test(passage.section) && !excludedSection.test(passage.section) && action.test(passage.quote) && !claims.some((claim) => claim.start === passage.start))
  const datedPassages = []
  const ranges = []
  for (const passage of passages) {
    if (excludedSection.test(passage.section)) continue
    for (const match of passage.quote.matchAll(/\b((?:19|20)\d{2})\s*[-–—]\s*((?:19|20)\d{2}|present|current)\b/ig)) {
      const start = Number(match[1])
      const end = /present|current/i.test(match[2]) ? now.getFullYear() + now.getMonth() / 12 : Number(match[2]) + 1
      if (end >= start) {
        ranges.push([start, end])
        datedPassages.push(passage)
      }
    }
  }
  const claimedYears = claims.length ? Math.max(...claims.map((claim) => claim.years)) : null
  const timelineYears = ranges.length ? mergeYears(ranges) : null
  const supportedYears = timelineYears !== null
    ? (claimedYears === null ? timelineYears : Math.min(claimedYears, timelineYears))
    : (claimedYears !== null && supportingPassages.length ? claimedYears : null)
  const status = timelineYears !== null ? 'dated-timeline' : supportedYears !== null ? 'application-supported' : claimedYears !== null ? 'claim-only' : 'not-found'
  return { claimedYears, timelineYears, supportedYears, status, claims, datedPassages: [...new Map(datedPassages.map((item) => [item.start, item])).values()], supportingPassages: supportingPassages.slice(0, 4) }
}

export function extractExpectedSalaryLpa(text = '') {
  const match = text.match(/\b(?:expected|desired|target)\s+(?:salary|ctc|compensation)(?:\s+(?:is|of))?\s*[:\-]?\s*(?:₹|inr\s*)?(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?(?:\s+per\s+annum)?|lakh\s*p\.?a\.?)\b/i)
    || text.match(/\b(?:salary|ctc|compensation)\s+expectation\s*[:\-]?\s*(?:₹|inr\s*)?(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?(?:\s+per\s+annum)?|lakh\s*p\.?a\.?)\b/i)
  return match ? Number(match[1]) : null
}

export function compareSalary(candidate = {}, requisition = {}) {
  const suppliedExpected = Number.isFinite(Number(candidate.expectedSalaryLpa)) && candidate.expectedSalaryLpa !== '' && candidate.expectedSalaryLpa !== undefined ? Number(candidate.expectedSalaryLpa) : null
  const extractedExpected = suppliedExpected === null ? extractExpectedSalaryLpa(candidate.text || '') : null
  const expected = suppliedExpected ?? extractedExpected
  const expectationSource = suppliedExpected !== null ? 'candidate field' : extractedExpected !== null ? 'application text' : null
  const rawCap = requisition.constraints?.maxSalaryLpa
  const cap = Number.isFinite(Number(rawCap)) && rawCap !== '' && rawCap !== null && rawCap !== undefined ? Number(rawCap) : null
  if (cap === null) return { expected, cap, delta: null, status: 'no-cap', label: expected === null ? 'No salary information' : 'No job salary ceiling set', expectationSource }
  if (expected === null) return { expected, cap, delta: null, status: 'unknown', label: 'Candidate expectation not provided', expectationSource }
  const delta = rounded(expected - cap)
  return {
    expected, cap, delta,
    status: delta > 0 ? 'above-cap' : delta < 0 ? 'within-cap' : 'at-cap',
    label: delta > 0 ? `₹${delta} LPA above the job ceiling` : delta < 0 ? `₹${Math.abs(delta)} LPA below the job ceiling` : 'Exactly at the job salary ceiling', expectationSource,
  }
}

export function candidateExperienceSources(candidate = {}, requisition = {}) {
  const minimum = Number(requisition.constraints?.minExperienceYears) || 0
  const resume = analyzeExperienceText(candidate.text || '')
  const durationFlag = (candidate.flags || []).find((flag) => ['duration', 'duration-conflict'].includes(flag.rule))
  if (durationFlag) {
    resume.status = 'conflicting'
    resume.supportedYears = resume.timelineYears
    resume.flag = durationFlag
  }
  const linkedinResult = candidate.verification?.linkedin
  const linkedin = linkedinResult?.experience || (linkedinResult?.status === 'review-ready' && Array.isArray(linkedinResult.evidence) ? analyzeExperienceText(`EXPERIENCE\n${linkedinResult.evidence.join('\n')}`) : null)
  const github = candidate.verification?.github?.activity || null
  return { minimum, resume, linkedin, linkedinConnection: linkedinResult || null, github }
}

export function experienceStatusLabel(status) {
  return ({
    'dated-timeline': 'Dated timeline found',
    'application-supported': 'Supported inside résumé',
    'claim-only': 'Claim only',
    'not-found': 'Not stated',
    conflicting: 'Contradictory / unsupported',
  })[status] || 'Not verified'
}

// References always point to literal slices of the submitted application.
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export const containsTerm = (text, term) => new RegExp(`(?<![a-z0-9])${escape(term.trim())}${/(?:system|microservice|runbook|incident|metric)$/.test(term.trim()) ? 's?' : ''}(?![a-z0-9])`, 'i').test(text)
const action = /\b(built|developed|implemented|deployed|operated|created|led|owned|wrote|maintained|designed|shipped)\b/i
const expertise = /\b(expert|expertise|world.class|mastery|advanced|specialist)\b/i
const denial = /\b(?:no (?:\w+\s+){0,3}(?:experience|ownership)|(?:have |has |did |do |am |is )?not (?:\w+\s+){0,4}(?:worked|used|built|deployed|owned|led|operated|experienced)|never (?:\w+\s+){0,2}(?:used|worked|built|deployed|owned|led)|haven't|only (?:read|studied))\b/i
const limited = /\b(course(?:work)?|academic|toy|guided|classroom|tutorial|simulated|bootcamp|only (?:read|studied)|shadow(?:ed)?|assisted)\b/i
const sections = /^(?:resume|cover (?:note|letter)|education|experience|professional experience|work experience|employment|projects?|skills|summary|profile|claim|research|certifications|bootcamp project)\s*:?$/i

export function sourcePassages(text) {
  let section = 'Application', offset = 0
  return text.split('\n').flatMap((raw, index) => {
    const start = offset
    offset += raw.length + 1
    const quote = raw.trim()
    if (sections.test(quote)) section = quote.replace(/:$/, '')
    let cursor = 0
    return raw.split(/(?<=[.!?;])\s+(?=[A-Z])/).flatMap((part) => {
      const quote = part.trim()
      if (!quote) return []
      const localStart = raw.indexOf(quote, cursor)
      cursor = localStart + quote.length
      return [{ quote, section, line: index + 1, start: start + localStart, end: start + cursor }]
    })
  })
}

function dateBlocks(passages, now) {
  return passages.flatMap((p, index) => {
    if (/education/i.test(p.section)) return []
    return [...p.quote.matchAll(/\b((?:19|20)\d{2})\s*[-–—]\s*((?:19|20)\d{2}|present|current)\b/ig)].map((range) => {
      // Generous year-only bounds avoid treating imprecise dates as exact durations.
      const start = Number(range[1])
      const end = /present|current/i.test(range[2]) ? now.getFullYear() + (now.getMonth() + 1) / 12 : Number(range[2]) + 1
      const context = []
      if (index > 0 && !sections.test(passages[index - 1].quote)) context.push(passages[index - 1])
      context.push(p)
      for (let i = index + 1; i < passages.length; i++) {
        if (sections.test(passages[i].quote) || /\b(?:19|20)\d{2}\s*[-–—]/.test(passages[i].quote)) break
        context.push(passages[i])
      }
      return { start, end, context, date: p }
    }).filter((b) => b.end >= b.start)
  })
}

function unionYears(blocks) {
  const merged = []
  for (const range of blocks.map(({ start, end }) => [start, end]).sort((a, b) => a[0] - b[0])) {
    const last = merged.at(-1)
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1])
    else merged.push([...range])
  }
  return merged.reduce((sum, [start, end]) => sum + end - start, 0)
}

export function detectContradictions(text, requisition, now = new Date()) {
  const passages = sourcePassages(text), blocks = dateBlocks(passages, now), flags = []
  const add = (kind, rule, claim, evidence, assessment, criteriaIds) => {
    if (flags.some((f) => f.rule === rule && f.claim.start === claim.start)) return
    flags.push({ id: `check-${flags.length + 1}`, kind, rule, claim,
      evidence: [...new Map(evidence.filter((p) => p.start !== claim.start).map((p) => [p.start, p])).values()],
      assessment, criteriaIds, confidenceCap: kind === 'contradictory' ? 35 : 50 })
  }
  for (const claim of passages) {
    const duration = claim.quote.match(/\b(\d+(?:\.\d+)?)\+?\s+years?\s+(?:(?:of|in|with)\s+)?([^.!?;\n]{0,70})/i)
    const relevant = requisition.criteria.filter((c) => c.aliases.some((t) => containsTerm(claim.quote, t)))
    const subjects = [...new Set(relevant.flatMap((c) => c.aliases.filter((t) => containsTerm(claim.quote, t))))]
    const sameSubject = (p) => subjects.some((t) => containsTerm(p.quote, t))
    const positives = passages.filter((p) => p.start !== claim.start && sameSubject(p) && action.test(p.quote) && !denial.test(p.quote) && !limited.test(p.quote) && !/education|skills/i.test(p.section))
    if (duration && !denial.test(claim.quote) && (relevant.length || /experience/i.test(claim.quote))) {
      const years = Number(duration[1])
      if (subjects.length && !/\b(?:ago|as of|by 20\d{2})\b/i.test(claim.quote)) {
        const opposingDuration = passages.filter((p) => p.start > claim.start && sameSubject(p) && !denial.test(p.quote) && !/\b(?:ago|as of|by 20\d{2})\b/i.test(p.quote)).find((p) => {
          const other = p.quote.match(/\b(\d+(?:\.\d+)?)\+?\s+years?\s+(?:of\s+)?(?:[\w.+-]+\s+){0,3}experience\b/i)
          // Professional-only duration can differ from total duration without conflict.
          return other && Number(other[1]) !== years && /professional/i.test(p.quote) === /professional/i.test(claim.quote)
        })
        if (opposingDuration) add('contradictory', 'duration-conflict', claim, [opposingDuration], 'Different passages state different durations for the same skill without a dated explanation. Clarify the scope and timeline before relying on either number.', relevant.map((c) => c.id))
      }
      const matching = blocks.filter((b) => b.context.some((p) => p.start !== claim.start && (!subjects.length || sameSubject(p))))
      const maxYears = unionYears(matching)
      if (years > maxYears) {
        const context = matching.length ? matching : blocks.filter((b) => /experience|employment|projects?/i.test(b.date.section))
        add('unsupported', 'duration', claim, context.flatMap((b) => b.context),
          `The application does not document ${years} years of ${subjects.length ? subjects[0].trim() + ' ' : ''}experience. ${matching.length ? `Relevant dated entries cover at most ${Math.round(maxYears * 10) / 10} years using generous year-only bounds and merging overlaps.` : 'No dated work or project entry ties this duration to supporting experience.'} Education dates do not establish skill experience. Earlier or undated experience may exist, but cannot be inferred.`, relevant.map((c) => c.id))
      }
    }
    if (subjects.length && (action.test(claim.quote) || expertise.test(claim.quote) || duration) && !denial.test(claim.quote)) {
      for (const other of passages.filter((p) => p.start !== claim.start && sameSubject(p) && denial.test(p.quote))) {
        // A time-qualified denial requires a timeline comparison these rules cannot establish.
        if (/\b(?:before|until|since|previously|at that time)\b/i.test(other.quote)) continue
        if (/\bproduction\b/i.test(other.quote) && !/\bproduction\b/i.test(claim.quote)) continue
        if (/\b(?:led|owned|ownership)\b/i.test(other.quote) && !/\b(?:led|owned|ownership)\b/i.test(claim.quote)) continue
        if (limited.test(claim.quote)) continue
        add('contradictory', 'conflicting-passages', claim, [other], 'These passages make a positive claim and an explicit denial about the same skill and scope. The application cannot resolve the conflict; validate both passages with the candidate.', relevant.map((c) => c.id))
      }
    }
    if (expertise.test(claim.quote) && relevant.length && !denial.test(claim.quote) && !positives.length && !(action.test(claim.quote) && !limited.test(claim.quote))) {
      add('unsupported', 'expertise', claim, passages.filter((p) => p.start !== claim.start && sameSubject(p)), 'The claimed expertise is not backed by a concrete work or independent project example for the same skill. A course reference or skill list alone does not demonstrate expert proficiency.', relevant.map((c) => c.id))
    }
    if (/\b(?:lead|head|senior|principal)\s+(?:software |platform |backend )?(?:engineer|developer|architect)\b/i.test(claim.quote)) {
      const nextTitle = passages.find((p) => p.start > claim.start && /\b(?:engineer|developer|architect)\b/i.test(p.quote) && !action.test(p.quote))
      const responsibility = passages.filter((p) => p.start > claim.start && (!nextTitle || p.start < nextTitle.start) && p.section === claim.section && /\b(?:only (?:shadowed|observed|assisted)|no (?:technical |engineering )?ownership|did not (?:lead|own))\b/i.test(p.quote))
      if (responsibility.length) add('unsupported', 'title-scope', claim, responsibility, 'The title suggests seniority or leadership, while the described responsibilities explicitly limit ownership. Titles vary between organizations; clarify scope rather than assuming the title is false.', relevant.map((c) => c.id))
    }
  }
  return flags
}

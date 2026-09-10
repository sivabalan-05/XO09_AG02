import { analyzeExperienceText } from './candidateFacts.js'

const meetsLevel = (level) => ['strong', 'supported'].includes(level)

function constraintEvaluation(candidate, constraints) {
  const results = []
  if (constraints.minExperienceYears > 0) {
    const experience = analyzeExperienceText(candidate.text)
    const durationFlag = candidate.flags?.some((flag) => ['duration', 'duration-conflict'].includes(flag.rule))
    const years = durationFlag ? experience.timelineYears : experience.supportedYears
    const description = years === null
      ? (experience.claimedYears === null ? 'No supported total-experience duration' : `${experience.claimedYears} years claimed without separate supporting work evidence`)
      : `${years} supported years vs ${constraints.minExperienceYears}+ required`
    results.push({ id: 'experience', name: `${constraints.minExperienceYears}+ years experience`, value: years, meets: years !== null && years >= constraints.minExperienceYears, known: years !== null, tradeoff: description })
  }
  if (Number.isFinite(constraints.maxSalaryLpa)) {
    const salary = candidate.expectedSalaryLpa
    results.push({ id: 'salary', name: `Salary ≤ ₹${constraints.maxSalaryLpa} LPA`, value: salary, meets: Number.isFinite(salary) && salary <= constraints.maxSalaryLpa, known: Number.isFinite(salary), tradeoff: Number.isFinite(salary) ? `Expected ₹${salary} LPA vs ₹${constraints.maxSalaryLpa} LPA cap` : 'No salary expectation supplied' })
  }
  return results
}

export function analyzeRequisition(screened, requisition) {
  const constraints = { minExperienceYears: 0, maxSalaryLpa: null, seniority: '', ...(requisition.constraints || {}) }
  const required = requisition.criteria.filter((criterion) => criterion.type === 'required')
  const conflicts = []
  if (/junior|entry|graduate/i.test(`${requisition.title} ${constraints.seniority}`) && constraints.minExperienceYears >= 5) {
    conflicts.push({ id: 'junior-experience', severity: 'conflict', title: 'Junior level vs. 5+ years experience', detail: 'The requisition asks for junior-level hiring while requiring experience normally associated with a more experienced candidate. Confirm which constraint is essential.' })
  }
  const stretchRequired = required.filter((criterion) => criterion.stretch)
  if (/junior|entry|graduate/i.test(`${requisition.title} ${constraints.seniority}`) && stretchRequired.length) {
    conflicts.push({ id: 'junior-stretch', severity: 'restrictive', title: 'Junior level vs. exceptional ownership bar', detail: `The junior-level role requires ${stretchRequired.map((criterion) => criterion.name).join(', ')}. This may reduce the viable pool; decide whether it is truly required or preferred.` })
  }
  if (constraints.maxSalaryLpa !== null && constraints.minExperienceYears >= 5) {
    conflicts.push({ id: 'salary-experience', severity: 'restrictive', title: 'Experience floor plus salary cap', detail: 'A strict experience floor combined with a fixed salary cap is highly restrictive. The agent cannot infer market rates; validate the budget with the hiring team.' })
  }
  const requirementCoverage = [
    ...required.map((criterion) => {
      const met = screened.filter((candidate) => meetsLevel(candidate.assessments.find((item) => item.criterionId === criterion.id)?.level)).length
      return { id: criterion.id, name: criterion.name, type: 'criterion', met, total: screened.length, coverage: screened.length ? Math.round(met / screened.length * 100) : 0 }
    }),
    ...(['experience', 'salary'].map((id) => ({ id, values: screened.map((candidate) => constraintEvaluation(candidate, constraints).find((item) => item.id === id)).filter(Boolean) })).filter((item) => item.values.length).map(({ id, values }) => ({ id, name: values[0].name, type: 'constraint', met: values.filter((item) => item.meets).length, total: screened.length, coverage: screened.length ? Math.round(values.filter((item) => item.meets).length / screened.length * 100) : 0 }))),
  ]
  const candidates = screened.map((candidate) => {
    const unmetCriteria = required.filter((criterion) => !meetsLevel(candidate.assessments.find((item) => item.criterionId === criterion.id)?.level)).map((criterion) => criterion.name)
    const evaluations = constraintEvaluation(candidate, constraints)
    const unmetConstraints = evaluations.filter((item) => !item.meets).map((item) => item.tradeoff)
    const strengths = required.filter((criterion) => meetsLevel(candidate.assessments.find((item) => item.criterionId === criterion.id)?.level)).map((criterion) => criterion.name)
    const fullyMeets = unmetCriteria.length === 0 && unmetConstraints.length === 0
    return { candidate, strengths, unmetCriteria, unmetConstraints, fullyMeets, matchedRequired: strengths.length, tradeoffs: [...unmetCriteria, ...unmetConstraints, ...candidate.flags.map((flag) => `Claim check: ${flag.rule.replaceAll('-', ' ')}`)] }
  })
  const fullMatches = candidates.filter((item) => item.fullyMeets)
  const shortlist = [...candidates].sort((a, b) => b.matchedRequired - a.matchedRequired || a.tradeoffs.length - b.tradeoffs.length).slice(0, 5)
  return { conflicts, requirementCoverage, candidates, fullMatches, shortlist, noFullMatch: fullMatches.length === 0 }
}

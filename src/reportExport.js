import { levelLabels } from './screening.js'
import { candidateExperienceSources, compareSalary, experienceStatusLabel } from './candidateFacts.js'

// Spreadsheet applications interpret leading =, +, -, and @ as formulas. Resume
// text is untrusted input, so neutralize those prefixes before exporting it.
export function safeSpreadsheetCell(value) {
  return typeof value === 'string' && /^[=+\-@]/.test(value) ? `'${value}` : value
}

function safeRows(rows) {
  const populated = rows.length ? rows : [{ Status: 'No records for this section' }]
  return populated.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, safeSpreadsheetCell(value)]),
  ))
}

export function buildReportSheets({ screened, requisition, insights, requisitionAnalysis, generatedAt = new Date() }) {
  const fullMatchById = new Map(requisitionAnalysis.candidates.map((item) => [item.candidate.id, item]))
  const sheets = []
  const addSheet = (name, rows, widths) => sheets.push({ name, rows: safeRows(rows), widths })

  addSheet('Summary', [
    { Metric: 'Generated at', Value: generatedAt.toLocaleString() },
    { Metric: 'Requisition', Value: requisition.title },
    { Metric: 'Applicants analyzed', Value: screened.length },
    { Metric: 'Strong matches', Value: screened.filter((candidate) => ['Leading match', 'Strong match'].includes(candidate.band)).length },
    { Metric: 'Claim checks', Value: screened.reduce((total, candidate) => total + candidate.flags.length, 0) },
    { Metric: 'Full requisition matches', Value: requisitionAnalysis.fullMatches.length },
    { Metric: 'Shortlisting safeguard', Value: requisitionAnalysis.noFullMatch ? 'No candidate fully satisfies all required criteria.' : 'At least one candidate fully satisfies all required criteria.' },
    { Metric: 'Pool-wide gaps', Value: insights.filter((item) => item.isGap).map((item) => item.name).join('; ') || 'None' },
  ], [28, 95])

  addSheet('Shortlist', screened.map((candidate, index) => {
    const match = fullMatchById.get(candidate.id)
    return {
      Rank: index + 1,
      ID: candidate.id,
      Candidate: candidate.name,
      Role: candidate.role,
      'Fit band': candidate.band,
      'Required strong': `${candidate.requiredStrong}/${candidate.requiredTotal}`,
      'Evidence coverage': `${candidate.evidenceCoverage}%`,
      'Assessment confidence': `${candidate.confidence}%`,
      'Full requisition match': match?.fullyMeets ? 'Yes' : 'No',
      Strengths: match?.strengths.join('; ') || candidate.strength,
      'Visible trade-offs': match?.tradeoffs.join('; ') || candidate.tradeoff,
      'Claim checks': candidate.flags.length,
    }
  }), [7, 10, 22, 24, 18, 16, 18, 22, 22, 46, 70, 13])

  addSheet('Closest-fit shortlist', requisitionAnalysis.shortlist.map((item, index) => ({
    Rank: index + 1,
    ID: item.candidate.id,
    Candidate: item.candidate.name,
    'Required met': `${item.matchedRequired}/${requisition.criteria.filter((criterion) => criterion.type === 'required').length}`,
    'Total applicants in pool': screened.length,
    Strengths: item.strengths.join('; ') || 'No required area strongly evidenced',
    'Trade-offs': item.tradeoffs.join('; ') || 'No material gap identified',
  })), [7, 10, 22, 16, 20, 60, 70])

  addSheet('Criterion evidence', screened.flatMap((candidate) => candidate.assessments.map((assessment) => ({
    ID: candidate.id,
    Candidate: candidate.name,
    Criterion: requisition.criteria.find((criterion) => criterion.id === assessment.criterionId)?.name,
    Type: requisition.criteria.find((criterion) => criterion.id === assessment.criterionId)?.type,
    Assessment: levelLabels[assessment.level],
    Confidence: `${assessment.confidence}%`,
    'Equivalent terms': assessment.terms.join(', '),
    'Cited evidence': assessment.evidence.join(' | '),
    'External corroboration': assessment.externalCorroboration?.length ? assessment.externalCorroboration.map((item) => item.repo ? `${item.source} · ${item.repo}` : item.source).join('; ') : '',
    Rationale: assessment.reason,
  }))), [10, 22, 34, 12, 19, 13, 28, 85, 32, 68])

  addSheet('Claim checks', screened.flatMap((candidate) => candidate.flags.map((flag) => ({
    ID: candidate.id,
    Candidate: candidate.name,
    Flag: flag.kind.toUpperCase(),
    Rule: flag.rule,
    Claim: flag.claim.quote,
    'Claim source': `${flag.claim.section}, line ${flag.claim.line}`,
    'Evidence reviewed': flag.evidence.map((evidence) => evidence.quote).join(' | ') || 'No separate supporting passage found',
    Assessment: flag.assessment,
  }))), [10, 22, 20, 22, 58, 25, 85, 75])

  addSheet('Requisition analysis', [
    ...requisitionAnalysis.conflicts.map((conflict) => ({ Category: 'Conflict / restriction', Requirement: conflict.title, Pool_coverage: '', Finding: conflict.detail })),
    ...requisitionAnalysis.requirementCoverage.map((item) => ({ Category: item.type === 'constraint' ? 'Constraint coverage' : 'Required criterion coverage', Requirement: item.name, Pool_coverage: `${item.met}/${item.total} (${item.coverage}%)`, Finding: item.met === 0 ? 'No candidate has supported evidence / meets this requirement.' : 'See Shortlist for trade-offs.' })),
  ], [28, 42, 24, 95])

  addSheet('Criterion coverage', insights.map((insight) => ({
    ID: insight.id,
    Criterion: insight.name,
    Type: insight.type,
    Stretch: insight.stretch ? 'Yes' : 'No',
    'Coverage %': insight.coverage,
    'Supported (strong)': insight.strong,
    Partial: insight.partial,
    'Missing / claim-only': screened.length - insight.strong - insight.partial,
    'Pool-wide gap': insight.isGap ? 'Yes' : 'No',
  })), [10, 30, 12, 10, 12, 16, 10, 18, 14])

  addSheet('External evidence review', screened.flatMap((candidate) => {
    const sources = Object.values(candidate.verification || {}).filter(Boolean)
    if (!sources.length) return [{ ID: candidate.id, Candidate: candidate.name, Provider: 'None reviewed', Status: 'Not requested', Profile_or_source: '', 'Terminology signals': '', 'Recruiter note': 'No external evidence reviewed. Resume assessment remains based on the submitted application only.' }]
    return sources.map((source) => ({
      ID: candidate.id,
      Candidate: candidate.name,
      Provider: source.provider,
      Status: source.status,
      Profile_or_source: source.profile?.url || source.url || '',
      'Terminology signals': [...new Set((source.criteriaSignals || []).map((signal) => `${signal.criterion}: ${signal.terms.join(', ')}`))].join(' | '),
      'Recruiter note': source.disclaimer || source.message || 'Review evidence manually before relying on it.',
    }))
  }), [10, 22, 16, 25, 52, 58, 100])

  addSheet('Compensation & experience', screened.map((candidate) => {
    const salary = compareSalary(candidate, requisition)
    const experience = candidateExperienceSources(candidate, requisition)
    return {
      ID: candidate.id,
      Candidate: candidate.name,
      'Job salary ceiling (₹ LPA)': salary.cap ?? 'Not set',
      'Expected salary (₹ LPA)': salary.expected ?? 'Not provided',
      'Salary difference (₹ LPA)': salary.delta ?? 'Not comparable',
      'Salary assessment': salary.label,
      'Job minimum experience': experience.minimum ? `${experience.minimum}+ years` : 'Not set',
      'Résumé claimed experience': experience.resume.claimedYears ?? 'Not stated',
      'Résumé dated timeline': experience.resume.timelineYears ?? 'No dated timeline',
      'Résumé supported experience': experience.resume.supportedYears ?? 'Not established',
      'Résumé verification status': experienceStatusLabel(experience.resume.status),
      'LinkedIn verification status': experience.linkedin ? experienceStatusLabel(experience.linkedin.status) : 'Not reviewed',
      'LinkedIn supported experience': experience.linkedin?.supportedYears ?? 'Not established',
      'GitHub observed activity span': experience.github ? `${experience.github.spanYears} years` : 'Not reviewed',
      'GitHub recruiter note': 'Public repository activity is not proof of employment, professional tenure, authorship, or identity.',
    }
  }), [10, 22, 22, 22, 23, 42, 24, 24, 24, 27, 28, 28, 28, 28, 80])

  addSheet('Agent reviews', screened.map((candidate) => candidate.agentReview ? {
    ID: candidate.id,
    Candidate: candidate.name,
    Recommendation: candidate.agentReview.recommendation,
    Mode: candidate.agentReview.mode || 'n/a',
    'Model status': candidate.agentReview.modelStatus || 'n/a',
    Narrative: candidate.agentReview.narrative || '',
    'Execution trace': (candidate.agentReview.trace || []).map((step) => `${step.step}: ${step.detail}`).join(' | '),
  } : {
    ID: candidate.id, Candidate: candidate.name, Recommendation: 'Not yet run', Mode: '', 'Model status': '', Narrative: '', 'Execution trace': '',
  }), [10, 22, 32, 18, 30, 60, 110])

  addSheet('Interview recommendations', requisitionAnalysis.shortlist.flatMap((item) => {
    const candidate = item.candidate
    const flagQuestions = candidate.flags.map((flag) => ({ ID: candidate.id, Candidate: candidate.name, Priority: flag.kind === 'contradictory' ? 'High' : 'Medium', 'Area to validate': flag.rule.replaceAll('-', ' '), 'Why ask': flag.assessment, 'Suggested interview question': `Please walk us through this statement: “${flag.claim.quote}”. What was your specific responsibility, timeline, and outcome?` }))
    const gapQuestions = item.unmetCriteria.map((criterion) => ({ ID: candidate.id, Candidate: candidate.name, Priority: 'Medium', 'Area to validate': criterion, 'Why ask': 'Required evidence is partial, emerging, or absent in the submitted application.', 'Suggested interview question': `Describe the most relevant hands-on example you have for ${criterion}. What did you personally build, operate, or improve, and what was the measurable outcome?` }))
    const constraintQuestions = item.unmetConstraints.map((constraint) => ({ ID: candidate.id, Candidate: candidate.name, Priority: 'High', 'Area to validate': 'Requisition constraint', 'Why ask': constraint, 'Suggested interview question': 'Please clarify this requirement during the recruiter screen before progressing the candidate.' }))
    const questions = [...flagQuestions, ...gapQuestions, ...constraintQuestions]
    return questions.length ? questions : [{ ID: candidate.id, Candidate: candidate.name, Priority: 'Low', 'Area to validate': 'Depth and ownership', 'Why ask': 'No material gap was identified by the initial evidence review.', 'Suggested interview question': 'Choose one cited project and explain your individual ownership, a technical trade-off, and how you measured success.' }]
  }), [10, 22, 12, 34, 72, 105])

  return sheets
}

export async function downloadScreeningWorkbook(data) {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Verity'
  workbook.created = new Date()

  for (const definition of buildReportSheets(data)) {
    const sheet = workbook.addWorksheet(definition.name)
    const columns = Object.keys(definition.rows[0])
    sheet.columns = columns.map((key, index) => ({ header: key, key, width: definition.widths[index] || 20 }))
    sheet.addRows(definition.rows)
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }
    const header = sheet.getRow(1)
    header.height = 24
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF315C45' } }
    sheet.eachRow((row, rowNumber) => {
      row.alignment = { vertical: 'top', wrapText: true }
      if (rowNumber > 1 && rowNumber % 2 === 1) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F6F3' } }
      row.eachCell((cell) => { cell.border = { bottom: { style: 'thin', color: { argb: 'FFD9DED9' } } } })
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const filename = `verity-screening-report-${new Date().toISOString().slice(0, 10)}.xlsx`
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return filename
}

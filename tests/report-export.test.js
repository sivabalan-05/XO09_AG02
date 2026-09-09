import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReportSheets, safeSpreadsheetCell } from '../src/reportExport.js'
import { defaultRequisition, sampleCandidates } from '../src/data.js'
import { getPoolInsights, screenPool } from '../src/screening.js'
import { analyzeRequisition } from '../src/requisitionAnalysis.js'

test('Excel report contains every promised review section and handles empty rows', () => {
  const screened = screenPool(sampleCandidates, defaultRequisition)
  const insights = getPoolInsights(screened, defaultRequisition)
  const requisitionAnalysis = analyzeRequisition(screened, defaultRequisition)
  const sheets = buildReportSheets({ screened, requisition: defaultRequisition, insights, requisitionAnalysis, generatedAt: new Date('2026-09-09T12:00:00Z') })
  assert.deepEqual(sheets.map((sheet) => sheet.name), [
    'Summary', 'Shortlist', 'Closest-fit shortlist', 'Criterion evidence', 'Claim checks',
    'Requisition analysis', 'Criterion coverage', 'External evidence review', 'Agent reviews', 'Interview recommendations',
  ])
  assert.ok(sheets.every((sheet) => sheet.rows.length > 0))
  assert.equal(sheets.find((sheet) => sheet.name === 'Summary').rows.find((row) => row.Metric === 'Shortlisting safeguard').Value, 'No candidate fully satisfies all required criteria.')
})

test('Closest-fit shortlist sheet names each candidate with required-met and pool size', () => {
  const screened = screenPool(sampleCandidates, defaultRequisition)
  const insights = getPoolInsights(screened, defaultRequisition)
  const requisitionAnalysis = analyzeRequisition(screened, defaultRequisition)
  const sheets = buildReportSheets({ screened, requisition: defaultRequisition, insights, requisitionAnalysis })
  const rows = sheets.find((sheet) => sheet.name === 'Closest-fit shortlist').rows
  assert.equal(rows.length, requisitionAnalysis.shortlist.length)
  const first = rows[0]
  assert.equal(first.Rank, 1)
  assert.equal(first.Candidate, requisitionAnalysis.shortlist[0].candidate.name)
  assert.match(first['Required met'], /^\d\/\d$/)
  assert.equal(first['Total applicants in pool'], screened.length)
})

test('Criterion coverage sheet reports every criterion in the requisition, including preferred ones', () => {
  const screened = screenPool(sampleCandidates, defaultRequisition)
  const insights = getPoolInsights(screened, defaultRequisition)
  const requisitionAnalysis = analyzeRequisition(screened, defaultRequisition)
  const sheets = buildReportSheets({ screened, requisition: defaultRequisition, insights, requisitionAnalysis })
  const rows = sheets.find((sheet) => sheet.name === 'Criterion coverage').rows
  assert.equal(rows.length, defaultRequisition.criteria.length)
  assert.ok(rows.some((row) => row.Type === 'preferred'))
  const gapRow = rows.find((row) => row['Pool-wide gap'] === 'Yes')
  assert.ok(gapRow)
  assert.equal(gapRow['Coverage %'], 0)
})

test('untrusted application text cannot become an Excel formula', () => {
  assert.equal(safeSpreadsheetCell('=HYPERLINK("https://evil.invalid")'), "'=HYPERLINK(\"https://evil.invalid\")")
  assert.equal(safeSpreadsheetCell('+cmd'), "'+cmd")
  assert.equal(safeSpreadsheetCell('Normal evidence'), 'Normal evidence')
})

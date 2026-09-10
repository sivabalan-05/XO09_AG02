const pptxgen = require('pptxgenjs')

const pptx = new pptxgen()
pptx.layout = 'LAYOUT_WIDE'
pptx.author = 'Team XO09_AG02'
pptx.subject = 'PS02 Autonomous Talent-Acquisition Screening Agent'
pptx.title = 'Verity — Evidence Before Keywords'
pptx.company = 'Team XO09_AG02'
pptx.lang = 'en-IN'
pptx.theme = {
  headFontFace: 'Aptos Display',
  bodyFontFace: 'Aptos',
  lang: 'en-IN',
}
pptx.defineLayout({ name: 'VERITY_WIDE', width: 13.333, height: 7.5 })
pptx.layout = 'VERITY_WIDE'
pptx.margin = 0

const C = {
  paper: 'FBF8F3',
  white: 'FFFFFF',
  ink: '18221C',
  muted: '5D6A62',
  faint: '87928B',
  moss: '2E6B4A',
  mossDark: '1D5036',
  mint: 'DDEDE2',
  mint2: 'EEF6F0',
  lime: 'CDEB8B',
  rose: 'C12E60',
  rosePale: 'F8E7ED',
  amber: 'B07B25',
  amberPale: 'FBF0D9',
  blue: '426B87',
  bluePale: 'EAF2F7',
  red: 'B4443B',
  redPale: 'F9EAE8',
  line: 'DDE3DD',
  lineDark: 'C9D2CA',
}

const FONT_HEAD = 'Aptos Display'
const FONT_BODY = 'Aptos'
const FONT_MONO = 'Menlo'

function addText(slide, text, x, y, w, h, options = {}) {
  slide.addText(text, {
    x, y, w, h,
    fontFace: options.fontFace || FONT_BODY,
    fontSize: options.fontSize || 16,
    color: options.color || C.ink,
    bold: options.bold || false,
    margin: options.margin ?? 0,
    valign: options.valign || 'mid',
    breakLine: false,
    fit: options.fit || 'shrink',
    align: options.align || 'left',
    ...options,
  })
}

function rounded(slide, x, y, w, h, fill = C.white, line = C.line, radius = 0.12) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    rectRadius: radius,
    fill: { color: fill },
    line: { color: line, width: 1 },
  })
}

function line(slide, x, y, w, h, color = C.lineDark, width = 1, dash = 'solid', endArrowType) {
  slide.addShape(pptx.ShapeType.line, {
    x, y, w, h,
    line: { color, width, dashType: dash, endArrowType },
  })
}

function circle(slide, x, y, d, fill, lineColor = fill) {
  slide.addShape(pptx.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color: fill }, line: { color: lineColor } })
}

function pill(slide, text, x, y, w, fill = C.mint2, color = C.moss, size = 10) {
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h: 0.34, rectRadius: 0.17, fill: { color: fill }, line: { color: fill } })
  addText(slide, text.toUpperCase(), x, y, w, 0.34, { fontSize: size, color, bold: true, align: 'center', charSpacing: 1.2 })
}

function addBase(slide, n, section, title, subtitle) {
  slide.background = { color: C.paper }
  circle(slide, 11.82, -0.72, 2.35, C.mint2, C.mint2)
  circle(slide, -0.72, 6.7, 1.6, C.rosePale, C.rosePale)
  addText(slide, `VERITY  /  ${section.toUpperCase()}`, 0.58, 0.28, 5.4, 0.25, { fontSize: 9, color: C.moss, bold: true, charSpacing: 1.5 })
  pill(slide, String(n).padStart(2, '0'), 12.23, 0.23, 0.5, C.white, C.faint, 8.5)
  addText(slide, title, 0.58, 0.68, 11.7, 0.62, { fontFace: FONT_HEAD, fontSize: 29, bold: true, color: C.ink })
  if (subtitle) addText(slide, subtitle, 0.6, 1.32, 11.2, 0.42, { fontSize: 12, color: C.muted })
  line(slide, 0.58, 7.15, 12.16, 0, C.line, 0.8)
  addText(slide, 'TEAM XO09_AG02  •  PS02', 0.58, 7.2, 3.8, 0.18, { fontSize: 7.5, color: C.faint, bold: true, charSpacing: 1.1 })
  addText(slide, 'EVIDENCE BEFORE KEYWORDS', 9.2, 7.2, 3.52, 0.18, { fontSize: 7.5, color: C.faint, bold: true, align: 'right', charSpacing: 1.1 })
}

function addCue(slide, text) {
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.58, y: 6.48, w: 12.16, h: 0.46, rectRadius: 0.14, fill: { color: C.white }, line: { color: C.line } })
  circle(slide, 0.75, 6.61, 0.18, C.lime, C.lime)
  addText(slide, 'SPEAKER CUE', 1.01, 6.55, 1.15, 0.25, { fontSize: 8.2, color: C.mossDark, bold: true, charSpacing: 1 })
  addText(slide, text, 2.04, 6.52, 10.42, 0.31, { fontSize: 9.5, color: C.muted, italic: true })
}

function note(slide, text) {
  slide.addNotes(text)
}

function bulletList(slide, items, x, y, w, options = {}) {
  const gap = options.gap || 0.52
  items.forEach((item, i) => {
    const yy = y + i * gap
    circle(slide, x, yy + 0.08, 0.14, options.dot || C.moss, options.dot || C.moss)
    addText(slide, item, x + 0.25, yy, w - 0.25, gap - 0.04, { fontSize: options.fontSize || 12.5, color: options.color || C.ink, valign: 'top' })
  })
}

function card(slide, { x, y, w, h, eyebrow, title, body, fill = C.white, accent = C.moss, icon }) {
  rounded(slide, x, y, w, h, fill, C.line)
  slide.addShape(pptx.ShapeType.rect, { x, y, w: 0.07, h, fill: { color: accent }, line: { color: accent } })
  if (icon) {
    circle(slide, x + 0.24, y + 0.23, 0.42, accent, accent)
    addText(slide, icon, x + 0.24, y + 0.23, 0.42, 0.42, { fontSize: 11, color: C.white, bold: true, align: 'center' })
  }
  const tx = icon ? x + 0.8 : x + 0.28
  if (eyebrow) addText(slide, eyebrow.toUpperCase(), tx, y + 0.18, w - (tx - x) - 0.2, 0.22, { fontSize: 7.5, color: accent, bold: true, charSpacing: 0.9 })
  addText(slide, title, tx, y + (eyebrow ? 0.43 : 0.22), w - (tx - x) - 0.22, 0.42, { fontSize: 15, bold: true, color: C.ink, valign: 'top' })
  addText(slide, body, tx, y + (eyebrow ? 0.9 : 0.69), w - (tx - x) - 0.24, h - (eyebrow ? 1.08 : 0.87), { fontSize: 10.5, color: C.muted, valign: 'top', breakLine: true, paraSpaceAfterPt: 5 })
}

function arrow(slide, x1, y1, x2, y2, color = C.moss) {
  line(slide, x1, y1, x2 - x1, y2 - y1, color, 1.5, 'solid', 'triangle')
}

function metric(slide, x, y, w, value, label, accent, noteText) {
  rounded(slide, x, y, w, 1.2, C.white, C.line)
  addText(slide, value, x + 0.22, y + 0.16, w - 0.44, 0.5, { fontFace: FONT_HEAD, fontSize: 27, bold: true, color: accent })
  addText(slide, label, x + 0.22, y + 0.64, w - 0.44, 0.23, { fontSize: 9.5, bold: true, color: C.ink })
  if (noteText) addText(slide, noteText, x + 0.22, y + 0.9, w - 0.44, 0.18, { fontSize: 7.8, color: C.faint })
}

// 1 — Title
{
  const slide = pptx.addSlide()
  slide.background = { color: C.paper }
  slide.addShape(pptx.ShapeType.arc, { x: 8.65, y: -1.2, w: 5.8, h: 5.8, adjustPoint: 0.3, rotate: 12, fill: { color: C.mint }, line: { color: C.mint } })
  circle(slide, 10.26, 3.2, 2.2, C.rosePale, C.rosePale)
  circle(slide, 11.47, 4.38, 0.7, C.lime, C.lime)
  pill(slide, 'PS02 • AGENTIC AI', 0.68, 0.62, 2.05, C.mint2, C.moss, 9)
  addText(slide, 'VERITY', 0.68, 1.42, 7.2, 0.85, { fontFace: FONT_HEAD, fontSize: 52, bold: true, color: C.ink, charSpacing: 1 })
  addText(slide, 'Evidence before keywords.', 0.7, 2.3, 7.2, 0.64, { fontFace: FONT_HEAD, fontSize: 30, color: C.rose, bold: true })
  addText(slide, 'An autonomous talent-acquisition screening agent that verifies claims, detects contradictions, understands equivalent skills, and explains candidate trade-offs.', 0.72, 3.12, 6.7, 1.1, { fontSize: 16, color: C.muted, valign: 'top', breakLine: true })
  rounded(slide, 0.7, 5.35, 6.45, 0.72, C.white, C.line)
  circle(slide, 0.98, 5.58, 0.24, C.moss, C.moss)
  addText(slide, 'TEAM XO09_AG02', 1.36, 5.47, 2.6, 0.24, { fontSize: 10, color: C.moss, bold: true, charSpacing: 1.2 })
  addText(slide, 'Autonomous Talent-Acquisition Screening Agent', 1.36, 5.71, 4.9, 0.2, { fontSize: 9.2, color: C.faint })
  addText(slide, '01', 11.97, 6.71, 0.55, 0.3, { fontSize: 10, color: C.faint, bold: true, align: 'center' })
  note(slide, 'Opening: Good morning. Our project is Verity, an evidence-first autonomous talent-acquisition screening agent. Most screening systems ask whether a resume contains a keyword. Verity asks a harder and more useful question: has the applicant provided enough evidence for the recruiter to trust that claim? This distinction drives every part of our system.')
}

// 2 — One-minute overview
{
  const slide = pptx.addSlide()
  addBase(slide, 2, 'The pitch', 'Verity in one minute', 'The shortest complete explanation of the project.')
  rounded(slide, 0.6, 1.95, 7.55, 4.18, C.white, C.line)
  addText(slide, 'What enters the system', 0.9, 2.2, 2.2, 0.3, { fontSize: 11, color: C.faint, bold: true })
  pill(slide, 'JOB REQUISITION', 0.9, 2.66, 1.65, C.bluePale, C.blue, 8)
  pill(slide, 'RESUME + NOTE', 2.72, 2.66, 1.65, C.rosePale, C.rose, 8)
  pill(slide, 'OPTIONAL EVIDENCE', 4.54, 2.66, 1.9, C.amberPale, C.amber, 8)
  arrow(slide, 3.72, 3.28, 3.72, 3.82, C.moss)
  rounded(slide, 1.15, 3.82, 5.16, 1.08, C.mint2, C.mint)
  addText(slide, 'LANGCHAIN ORCHESTRATION', 1.45, 4.03, 4.55, 0.22, { fontSize: 8.5, color: C.moss, bold: true, align: 'center', charSpacing: 1.2 })
  addText(slide, 'Understand requirements → verify evidence → apply policy', 1.45, 4.29, 4.55, 0.34, { fontSize: 13, color: C.ink, bold: true, align: 'center' })
  arrow(slide, 3.72, 4.91, 3.72, 5.37, C.moss)
  addText(slide, 'Explainable shortlist + pool gaps + Excel report', 1.32, 5.47, 4.82, 0.35, { fontSize: 12, color: C.mossDark, bold: true, align: 'center' })
  card(slide, { x: 8.45, y: 1.95, w: 4.25, h: 1.18, eyebrow: 'CORE PROMISE', title: 'No evidence, no confidence', body: 'A skill list is weaker than a project or work example.', fill: C.mint2, accent: C.moss, icon: '1' })
  card(slide, { x: 8.45, y: 3.3, w: 4.25, h: 1.18, eyebrow: 'FAIR MATCHING', title: 'Meaning, not exact wording', body: 'Approved aliases recognize equivalent tools and terminology.', fill: C.bluePale, accent: C.blue, icon: '2' })
  card(slide, { x: 8.45, y: 4.65, w: 4.25, h: 1.18, eyebrow: 'HONEST OUTPUT', title: 'Trade-offs stay visible', body: 'The system never hides weaknesses behind one percentage.', fill: C.rosePale, accent: C.rose, icon: '3' })
  addCue(slide, '“Verity automates evidence organization, not the final hiring decision.”')
  note(slide, 'Use this slide if faculty asks for the entire project in one answer. The recruiter gives a requisition and applications. LangChain coordinates the steps, but deterministic rules evaluate the evidence. The output is a criterion-by-criterion assessment, contradiction flags, a shortlist with visible trade-offs, pool gaps, and an Excel report. Verity supports the recruiter; it does not automatically hire or reject anyone.')
}

// 3 — Problem
{
  const slide = pptx.addSlide()
  addBase(slide, 3, 'Problem', 'Why keyword matching fails', 'The word may be present while the evidence is missing.')
  const items = [
    ['01', 'Resume padding', 'A candidate can list Kubernetes without showing where or how it was used.', C.rosePale, C.rose],
    ['02', 'Vocabulary mismatch', 'SQL and MySQL may describe relevant knowledge using different wording.', C.bluePale, C.blue],
    ['03', 'Conflicting claims', '“Five years of Python” can conflict with a one-year documented timeline.', C.redPale, C.red],
    ['04', 'Impossible requisitions', 'Junior level, five years of experience, rare skills, and low salary may not coexist.', C.amberPale, C.amber],
  ]
  items.forEach(([num, title, body, fill, accent], i) => {
    const x = 0.62 + (i % 2) * 6.12
    const y = 1.96 + Math.floor(i / 2) * 1.93
    rounded(slide, x, y, 5.84, 1.62, fill, fill)
    addText(slide, num, x + 0.24, y + 0.25, 0.52, 0.38, { fontFace: FONT_HEAD, fontSize: 20, bold: true, color: accent })
    addText(slide, title, x + 0.95, y + 0.24, 4.55, 0.34, { fontSize: 15, bold: true })
    addText(slide, body, x + 0.95, y + 0.69, 4.46, 0.66, { fontSize: 11.2, color: C.muted, valign: 'top' })
  })
  addCue(slide, '“The core challenge is not finding a word. It is deciding whether the claim deserves trust.”')
  note(slide, 'Traditional screening can reward the person who writes the most keywords. It can also reject a genuine candidate who uses another valid term. Our problem statement requires us to distinguish a claim from evidence, recognize equivalent wording, explain trade-offs, and admit when the requisition itself is unrealistic.')
}

// 4 — Proposed solution
{
  const slide = pptx.addSlide()
  addBase(slide, 4, 'Proposed solution', 'An evidence-first screening pipeline', 'Each stage produces an auditable output for the next stage.')
  const stages = [
    ['01', 'Understand', 'Build an approved requirement map'],
    ['02', 'Extract', 'Read PDF, DOCX, TXT, MD and cover notes'],
    ['03', 'Verify', 'Find claims, actions, context and outcomes'],
    ['04', 'Challenge', 'Detect conflicts and unsupported statements'],
    ['05', 'Compare', 'Expose strengths, gaps, salary and experience'],
    ['06', 'Report', 'Shortlist, pool insights and Excel workbook'],
  ]
  stages.forEach((s, i) => {
    const x = 0.58 + i * 2.08
    const y = i % 2 === 0 ? 2.05 : 3.52
    const accent = [C.moss, C.blue, C.rose, C.red, C.amber, C.moss][i]
    rounded(slide, x, y, 1.78, 1.24, C.white, C.line)
    pill(slide, s[0], x + 0.14, y + 0.14, 0.44, accent === C.moss ? C.mint2 : (accent === C.rose || accent === C.red ? C.rosePale : accent === C.blue ? C.bluePale : C.amberPale), accent, 7.2)
    addText(slide, s[1], x + 0.15, y + 0.53, 1.48, 0.25, { fontSize: 12.5, bold: true })
    addText(slide, s[2], x + 0.15, y + 0.81, 1.47, 0.31, { fontSize: 8.8, color: C.muted, valign: 'top' })
    if (i < stages.length - 1) arrow(slide, x + 1.78, y + 0.62, x + 2.02, (i + 1) % 2 === 0 ? 2.67 : 4.14, C.lineDark)
  })
  rounded(slide, 1.7, 5.35, 9.92, 0.58, C.mint2, C.mint)
  addText(slide, 'OUTPUT PRINCIPLE', 2.0, 5.51, 1.4, 0.2, { fontSize: 8, color: C.moss, bold: true, charSpacing: 1 })
  addText(slide, 'Every result links back to the criterion, recognized term, source passage, and reasoning used.', 3.42, 5.45, 7.85, 0.28, { fontSize: 11.5, color: C.mossDark, bold: true })
  addCue(slide, 'Walk left to right: requirement understanding happens before candidate ranking.')
  note(slide, 'Our pipeline begins with the requisition, not the resume. We first define what good evidence looks like. We then extract each application, map terminology, assess evidence quality, run contradiction checks, compare candidate facts and finally report a shortlist. This order prevents the model from inventing reasons after it has already chosen a favourite candidate.')
}

// 5 — Innovation
{
  const slide = pptx.addSlide()
  addBase(slide, 5, 'Innovation', 'What makes Verity different', 'We separate understanding, evidence, policy, and presentation.')
  rounded(slide, 0.62, 1.94, 5.95, 4.27, C.redPale, C.redPale)
  rounded(slide, 6.78, 1.94, 5.95, 4.27, C.mint2, C.mint)
  pill(slide, 'ORDINARY ATS', 0.92, 2.2, 1.4, C.white, C.red, 8)
  pill(slide, 'VERITY', 7.08, 2.2, 1.03, C.white, C.moss, 8)
  const left = ['Exact keyword search', 'Treats skill list like work evidence', 'One opaque match percentage', 'Always forces a ranked winner', 'Static terminology bank']
  const right = ['Approved semantic terminology map', 'Scores claim support and operating context', 'Criterion-level explanation and citations', 'States when nobody fully matches', 'AI-generated terms with recruiter approval']
  left.forEach((t, i) => {
    circle(slide, 0.94, 2.82 + i * 0.59, 0.2, C.red, C.red)
    addText(slide, '×', 0.94, 2.81 + i * 0.59, 0.2, 0.2, { fontSize: 10, color: C.white, bold: true, align: 'center' })
    addText(slide, t, 1.27, 2.76 + i * 0.59, 4.75, 0.36, { fontSize: 11.5, color: C.ink })
    circle(slide, 7.1, 2.82 + i * 0.59, 0.2, C.moss, C.moss)
    addText(slide, '✓', 7.1, 2.81 + i * 0.59, 0.2, 0.2, { fontSize: 9, color: C.white, bold: true, align: 'center' })
    addText(slide, right[i], 7.43, 2.76 + i * 0.59, 4.72, 0.36, { fontSize: 11.5, color: C.ink })
  })
  addCue(slide, '“Our novelty is the trust model: language can suggest; only grounded evidence can satisfy a criterion.”')
  note(slide, 'The innovation is not simply that an LLM is present. The innovation is how its authority is limited. The model may propose terminology or summarize grounded results. It cannot silently change hard constraints, invent candidate evidence, or directly hire. Deterministic rules remain responsible for scoring evidence and producing policy outcomes.')
}

// 6 — User journey
{
  const slide = pptx.addSlide()
  addBase(slide, 6, 'User journey', 'From job description to decision support', 'The recruiter stays in control at every irreversible point.')
  const steps = [
    ['1', 'Create role', 'Title, description, salary, level'],
    ['2', 'Generate map', 'AI proposes criteria and aliases'],
    ['3', 'Approve', 'Recruiter reviews suggestions'],
    ['4', 'Upload', 'Resume and cover note'],
    ['5', 'Evaluate', 'Evidence, claims and contradictions'],
    ['6', 'Decide', 'Compare, shortlist, export'],
  ]
  line(slide, 1.35, 3.2, 10.68, 0, C.lineDark, 2)
  steps.forEach((s, i) => {
    const x = 0.68 + i * 2.08
    const alt = i % 2 === 0
    circle(slide, x + 0.45, 2.76, 0.88, i < 3 ? C.moss : C.rose, i < 3 ? C.moss : C.rose)
    addText(slide, s[0], x + 0.45, 2.76, 0.88, 0.88, { fontFace: FONT_HEAD, fontSize: 20, color: C.white, bold: true, align: 'center' })
    rounded(slide, x, alt ? 1.8 : 3.76, 1.78, 1.17, C.white, C.line)
    addText(slide, s[1], x + 0.15, (alt ? 1.8 : 3.76) + 0.18, 1.48, 0.3, { fontSize: 12, bold: true, align: 'center' })
    addText(slide, s[2], x + 0.15, (alt ? 1.8 : 3.76) + 0.54, 1.48, 0.4, { fontSize: 8.8, color: C.muted, align: 'center', valign: 'top' })
    line(slide, x + 0.89, alt ? 2.97 : 3.64, 0, alt ? -0.21 : 0.12, C.lineDark, 1.2)
  })
  rounded(slide, 2.14, 5.37, 9.05, 0.57, C.amberPale, C.amberPale)
  addText(slide, 'HUMAN CONTROL POINTS', 2.42, 5.53, 1.65, 0.2, { fontSize: 8, color: C.amber, bold: true, charSpacing: 1 })
  addText(slide, 'Approve terminology  •  Review evidence  •  Make the final hiring decision', 4.02, 5.47, 6.82, 0.29, { fontSize: 11.2, color: C.ink, bold: true })
  addCue(slide, 'Emphasize that “autonomous” means autonomous analysis, not autonomous hiring.')
  note(slide, 'The recruiter can change the role, generate a new requirement map, approve or reject individual suggestions, upload applications, and review the resulting evidence. The system automates repetitive analysis, but the recruiter controls the requisition configuration and the final decision.')
}

// 7 — Architecture
{
  const slide = pptx.addSlide()
  addBase(slide, 7, 'System architecture', 'Five layers, one traceable decision flow', 'The model is contained inside the agent layer; scoring lives in the policy layer.')
  const layers = [
    ['INTERFACE', 'React dashboard • requisition editor • resume upload • insights • Excel export', C.rosePale, C.rose],
    ['API', 'Express routes • validation • timeouts • sanitized errors', C.bluePale, C.blue],
    ['AGENT', 'LangChain sequences • Requirement Intelligence • grounded summary', C.mint2, C.moss],
    ['POLICY', 'Alias mapping • evidence quality • contradictions • constraints • shortlist', C.amberPale, C.amber],
    ['DATA + TOOLS', 'Local application state • OpenAI • GitHub API • authorized LinkedIn evidence', C.white, C.ink],
  ]
  layers.forEach((l, i) => {
    const y = 1.86 + i * 0.88
    rounded(slide, 1.1 + i * 0.18, y, 11.15 - i * 0.36, 0.68, l[2], l[2])
    pill(slide, l[0], 1.35 + i * 0.18, y + 0.17, 1.14, C.white, l[3], 7.5)
    addText(slide, l[1], 2.72 + i * 0.18, y + 0.14, 8.88 - i * 0.36, 0.35, { fontSize: 10.8, color: C.ink, bold: i === 2 })
    if (i < layers.length - 1) arrow(slide, 6.68, y + 0.7, 6.68, y + 0.86, C.lineDark)
  })
  addCue(slide, 'Point to Policy: this layer, not the LLM, decides evidence strength and candidate trade-offs.')
  note(slide, 'At the top, React presents the workflow. Express exposes stateless APIs. LangChain coordinates named agent steps. The deterministic policy layer performs evidence and contradiction analysis. Data and external services sit at the bottom. This separation lets us explain exactly which component is responsible for each result.')
}

// 8 — Technologies
{
  const slide = pptx.addSlide()
  addBase(slide, 8, 'Technologies used', 'A practical hackathon stack', 'Each technology has one clear responsibility.')
  const tech = [
    ['UI', 'React + Vite', 'Responsive recruiter dashboard and fast development', C.rose],
    ['API', 'Node.js + Express', 'Stateless routes for agents and evidence tools', C.blue],
    ['Agent', 'LangChain', 'Named, inspectable RunnableSequence workflows', C.moss],
    ['Model', 'OpenAI Chat Model', 'Structured requirement proposals and grounded summaries', C.moss],
    ['Policy', 'Zod + JavaScript rules', 'Strict schemas, evidence scoring and contradictions', C.amber],
    ['Documents', 'PDF.js + Mammoth', 'Browser extraction from PDF and DOCX files', C.blue],
    ['Evidence', 'GitHub REST + LinkedIn OIDC', 'Public metadata and consent-based identity flow', C.rose],
    ['Reports', 'ExcelJS', 'Ten-sheet recruiter audit workbook', C.amber],
    ['Quality', 'Node Test + ESLint', '49 automated checks and code-quality validation', C.moss],
  ]
  tech.forEach((t, i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    const x = 0.62 + col * 4.1
    const y = 1.85 + row * 1.38
    rounded(slide, x, y, 3.83, 1.12, C.white, C.line)
    circle(slide, x + 0.2, y + 0.24, 0.46, t[3], t[3])
    addText(slide, t[0].slice(0, 2), x + 0.2, y + 0.24, 0.46, 0.46, { fontSize: 8, color: C.white, bold: true, align: 'center' })
    addText(slide, t[1], x + 0.82, y + 0.18, 2.73, 0.29, { fontSize: 12.5, bold: true })
    addText(slide, t[2], x + 0.82, y + 0.52, 2.72, 0.42, { fontSize: 9.2, color: C.muted, valign: 'top' })
  })
  addCue(slide, 'If asked “where is the AI?”, answer: LangChain coordinates it; the OpenAI model only proposes or summarizes structured information.')
  note(slide, 'React and Vite build the interface. Express provides the backend. LangChain coordinates the agent workflows. OpenAI is optional for grounded summaries and required for generating new terminology. Zod validates model input and output. JavaScript rules remain the evidence authority. PDF.js and Mammoth read resumes. ExcelJS creates the report. GitHub and LinkedIn are optional evidence sources with strict limitations.')
}

// 9 — Requirement Intelligence
{
  const slide = pptx.addSlide()
  addBase(slide, 9, 'Agentic AI', 'Requirement Intelligence Agent', 'Any role can receive a terminology map without a permanent manual word bank.')
  rounded(slide, 0.63, 1.86, 3.1, 4.25, C.white, C.line)
  addText(slide, 'INPUT', 0.92, 2.13, 0.8, 0.25, { fontSize: 8, color: C.blue, bold: true, charSpacing: 1.2 })
  addText(slide, 'Unity Multiplayer Engineer', 0.92, 2.52, 2.46, 0.52, { fontFace: FONT_HEAD, fontSize: 20, bold: true })
  addText(slide, '“Build networked gameplay systems, optimize real-time state synchronization, and ship reliable Unity titles.”', 0.92, 3.21, 2.43, 1.12, { fontSize: 11.2, color: C.muted, italic: true, valign: 'top' })
  pill(slide, 'ENRICH', 0.92, 4.73, 0.95, C.bluePale, C.blue, 7.8)
  pill(slide, 'NEW MAP', 1.98, 4.73, 1.04, C.rosePale, C.rose, 7.8)
  addText(slide, 'Mode controls whether existing criteria are preserved or replaced.', 0.92, 5.29, 2.4, 0.44, { fontSize: 9.4, color: C.faint })
  arrow(slide, 3.76, 3.94, 4.29, 3.94, C.moss)
  rounded(slide, 4.31, 1.86, 4.18, 4.25, C.mint2, C.mint)
  pill(slide, 'LANGCHAIN WORKFLOW', 4.67, 2.13, 1.72, C.white, C.moss, 7.5)
  const nodes = [
    ['1', 'Validate + minimize input'],
    ['2', 'Generate structured proposal'],
    ['3', 'Remove duplicates + broad terms'],
    ['4', 'Return proposal, never auto-save'],
  ]
  nodes.forEach((n, i) => {
    circle(slide, 4.72, 2.7 + i * 0.7, 0.36, C.moss, C.moss)
    addText(slide, n[0], 4.72, 2.7 + i * 0.7, 0.36, 0.36, { fontSize: 9, color: C.white, bold: true, align: 'center' })
    addText(slide, n[1], 5.26, 2.68 + i * 0.7, 2.78, 0.37, { fontSize: 11, bold: true })
    if (i < 3) line(slide, 4.9, 3.08 + i * 0.7, 0, 0.28, C.moss, 1)
  })
  arrow(slide, 8.54, 3.94, 9.07, 3.94, C.moss)
  rounded(slide, 9.09, 1.86, 3.61, 4.25, C.white, C.line)
  addText(slide, 'REVIEWABLE OUTPUT', 9.39, 2.13, 1.5, 0.25, { fontSize: 8, color: C.rose, bold: true, charSpacing: 1.1 })
  addText(slide, 'Unity gameplay', 9.39, 2.56, 2.4, 0.3, { fontSize: 13, bold: true })
  pill(slide, 'UNITY3D', 9.39, 3.02, 0.98, C.mint2, C.moss, 7.2)
  pill(slide, 'C#', 10.48, 3.02, 0.56, C.bluePale, C.blue, 7.2)
  pill(slide, 'GAMEPLAY CODE', 11.15, 3.02, 1.24, C.mint2, C.moss, 7.2)
  addText(slide, 'Related, not equivalent', 9.39, 3.73, 2.35, 0.26, { fontSize: 9, color: C.amber, bold: true })
  pill(slide, 'UNREAL ENGINE', 9.39, 4.13, 1.28, C.amberPale, C.amber, 7.2)
  pill(slide, 'GODOT', 10.8, 4.13, 0.75, C.amberPale, C.amber, 7.2)
  addText(slide, 'Related terms remain unselected so they cannot create false matches.', 9.39, 4.74, 2.71, 0.7, { fontSize: 10, color: C.muted, valign: 'top' })
  addCue(slide, '“The recruiter no longer writes the bank; the agent proposes it, policy cleans it, and the recruiter approves it.”')
  note(slide, 'This agent solves the unknown-role problem. It receives only the role title, job description, and existing criteria. It never receives resumes or candidate data. LangChain validates the input, asks the model for a strict structured proposal, removes unsafe generic terms and returns a review screen. Equivalent and named technology terms can be selected. Related technologies remain separate and unselected. The proposal affects screening only after Apply and Save.')
}

// 10 — Evidence method
{
  const slide = pptx.addSlide()
  addBase(slide, 10, 'Evaluation method', 'How evidence quality is calculated', 'The same keyword produces different confidence depending on the surrounding passage.')
  const signals = [
    ['TERM', 'Criterion or approved alias appears', C.bluePale, C.blue],
    ['ACTION', 'Built, deployed, operated, led…', C.mint2, C.moss],
    ['OUTCOME', 'Numbers, scale, improvement or impact', C.rosePale, C.rose],
    ['CONTEXT', 'Production, customer, incident or ownership', C.amberPale, C.amber],
    ['CAVEAT', 'Course, toy project, assisted, simulated', C.redPale, C.red],
  ]
  signals.forEach((s, i) => {
    const x = 0.62 + i * 2.48
    rounded(slide, x, 1.88, 2.23, 1.18, s[2], s[2])
    pill(slide, s[0], x + 0.18, 2.08, 0.75, C.white, s[3], 7.2)
    addText(slide, s[1], x + 0.18, 2.5, 1.85, 0.36, { fontSize: 9.4, color: C.ink, bold: true, valign: 'top' })
  })
  addText(slide, 'Evidence ladder', 0.64, 3.54, 1.7, 0.3, { fontSize: 11, color: C.faint, bold: true })
  const levels = [
    ['NOT ADDRESSED', 'No relevant passage', C.lineDark, C.white],
    ['CLAIM ONLY', 'Skill stated; no example', C.red, C.redPale],
    ['EMERGING', 'Indirect or introductory', C.amber, C.amberPale],
    ['SUPPORTED', 'Hands-on example exists', C.blue, C.bluePale],
    ['STRONG', 'Outcome + real context', C.moss, C.mint2],
  ]
  levels.forEach((l, i) => {
    const x = 0.65 + i * 2.47
    rounded(slide, x, 3.96, 2.2, 1.26, l[3], l[0] === 'NOT ADDRESSED' ? C.line : l[3])
    slide.addShape(pptx.ShapeType.rect, { x, y: 3.96, w: 2.2, h: 0.08, fill: { color: l[2] }, line: { color: l[2] } })
    addText(slide, l[0], x + 0.16, 4.2, 1.87, 0.24, { fontSize: 8, color: l[2], bold: true, align: 'center', charSpacing: 0.7 })
    addText(slide, l[1], x + 0.16, 4.57, 1.87, 0.32, { fontSize: 9.5, color: C.ink, align: 'center' })
    if (i < 4) arrow(slide, x + 2.2, 4.58, x + 2.41, 4.58, C.lineDark)
  })
  rounded(slide, 2.04, 5.55, 9.26, 0.48, C.white, C.line)
  addText(slide, 'Confidence = strength of available evidence, not probability that the person is truthful.', 2.27, 5.66, 8.8, 0.22, { fontSize: 10.6, color: C.rose, bold: true, align: 'center' })
  addCue(slide, 'Use two examples: “Python” in Skills = claim only; “Built a Python API serving 4,000 users” = supported/strong.')
  note(slide, 'The engine first checks whether a criterion or alias appears. It then looks at the whole passage. An action verb shows hands-on work. A measurable outcome strengthens it. Production or ownership context strengthens it further. Caveats such as classroom, simulated, toy, or assisted work reduce the level. Missing evidence receives zero evidence confidence. Confidence describes the support we can cite, not whether the person is honest.')
}

// 11 — Surprise challenge 1
{
  const slide = pptx.addSlide()
  addBase(slide, 11, 'Surprise challenge 01', 'Contradiction detection with exact evidence', 'Every flag must show the claim and the passage that caused the concern.')
  card(slide, { x: 0.62, y: 1.88, w: 3.45, h: 2.0, eyebrow: 'CLAIM', title: '“5 years of Python experience”', body: 'A strong duration statement appears in the summary.', fill: C.rosePale, accent: C.rose, icon: 'A' })
  arrow(slide, 4.14, 2.87, 4.72, 2.87, C.red)
  card(slide, { x: 4.76, y: 1.88, w: 3.45, h: 2.0, eyebrow: 'DOCUMENTED TIMELINE', title: 'Intern • 2024–2025', body: 'No earlier dated work or independent Python project is provided.', fill: C.bluePale, accent: C.blue, icon: 'B' })
  arrow(slide, 8.28, 2.87, 8.86, 2.87, C.red)
  card(slide, { x: 8.9, y: 1.88, w: 3.8, h: 2.0, eyebrow: 'ASSESSMENT', title: 'Unsupported duration claim', body: 'Confidence is capped. The system requests human validation and never invents the missing years.', fill: C.redPale, accent: C.red, icon: '!' })
  rounded(slide, 0.63, 4.23, 12.06, 1.63, C.white, C.line)
  addText(slide, 'TECHNICAL APPROACH', 0.92, 4.48, 1.62, 0.22, { fontSize: 8, color: C.moss, bold: true, charSpacing: 1.1 })
  const approaches = [
    ['1', 'Split application into passages'],
    ['2', 'Store section, line and offsets'],
    ['3', 'Extract dates and duration claims'],
    ['4', 'Compare positive claims vs limits'],
    ['5', 'Return cited flag + confidence cap'],
  ]
  approaches.forEach((a, i) => {
    const x = 0.94 + i * 2.32
    circle(slide, x, 4.93, 0.34, C.moss, C.moss)
    addText(slide, a[0], x, 4.93, 0.34, 0.34, { fontSize: 8, color: C.white, bold: true, align: 'center' })
    addText(slide, a[1], x + 0.47, 4.89, 1.65, 0.44, { fontSize: 9.2, color: C.ink, bold: true, valign: 'top' })
  })
  addCue(slide, 'Clarify: missing proof is “unsupported”; two incompatible passages are “contradictory.”')
  note(slide, 'For Surprise Challenge 1, we preserve exact source positions so every flag can quote the original text. We compare skill claims with action evidence, duration claims with dated work blocks, titles with described responsibility, and resume claims with cover-note limitations. A missing passage is not automatically called a contradiction. It is marked unsupported. A contradiction requires two incompatible statements. Both reduce confidence, but the explanation remains precise.')
}

// 12 — Surprise challenge 2
{
  const slide = pptx.addSlide()
  addBase(slide, 12, 'Surprise challenge 02', 'Requirement conflicts and trade-off shortlisting', 'When no applicant satisfies everything, the system says so explicitly.')
  rounded(slide, 0.62, 1.86, 4.15, 4.3, C.white, C.line)
  addText(slide, 'POOL COVERAGE', 0.91, 2.13, 1.4, 0.22, { fontSize: 8, color: C.moss, bold: true, charSpacing: 1.1 })
  const coverage = [
    ['5+ years experience', 2, 10, C.red],
    ['Kubernetes', 4, 10, C.blue],
    ['AI / ML', 7, 10, C.moss],
    ['Salary ≤ ₹8 LPA', 6, 10, C.amber],
  ]
  coverage.forEach((r, i) => {
    const y = 2.65 + i * 0.72
    addText(slide, r[0], 0.91, y, 1.82, 0.24, { fontSize: 9.7, bold: true })
    slide.addShape(pptx.ShapeType.roundRect, { x: 2.76, y: y + 0.02, w: 1.18, h: 0.18, rectRadius: 0.09, fill: { color: C.line }, line: { color: C.line } })
    slide.addShape(pptx.ShapeType.roundRect, { x: 2.76, y: y + 0.02, w: 1.18 * (r[1] / r[2]), h: 0.18, rectRadius: 0.09, fill: { color: r[3] }, line: { color: r[3] } })
    addText(slide, `${r[1]}/${r[2]}`, 4.02, y - 0.02, 0.43, 0.25, { fontSize: 9, color: r[3], bold: true, align: 'right' })
  })
  rounded(slide, 0.91, 5.42, 3.56, 0.48, C.redPale, C.redPale)
  addText(slide, 'No candidate fully satisfies all required criteria.', 1.08, 5.53, 3.21, 0.22, { fontSize: 9.5, color: C.red, bold: true, align: 'center' })
  const candidates = [
    ['A', '6 yrs • strong AI/ML', '₹11 LPA • no Kubernetes', C.rosePale, C.rose],
    ['B', 'AI/ML • Kubernetes • ₹7L', 'Only 2 years experience', C.mint2, C.moss],
    ['C', '5 yrs • Kubernetes • ₹8L', 'AI/ML evidence is moderate', C.bluePale, C.blue],
  ]
  candidates.forEach((c, i) => {
    card(slide, { x: 5.08, y: 1.86 + i * 1.43, w: 7.62, h: 1.18, eyebrow: `CANDIDATE ${c[0]}`, title: c[1], body: `Trade-off: ${c[2]}`, fill: c[3], accent: c[4], icon: c[0] })
  })
  addCue(slide, '“We rank closeness for review, but we never convert an impossible requisition into a fake 100% match.”')
  note(slide, 'For Surprise Challenge 2, we analyze both the job and the pool. We calculate coverage for every required criterion and for experience, salary, and seniority constraints. We detect combinations such as a junior role requiring five years. If nobody meets everything, Verity says that directly. It still identifies the closest candidates, but shows what each person gives up: salary, experience, Kubernetes, AI depth, or another requirement.')
}

// 13 — External verification
{
  const slide = pptx.addSlide()
  addBase(slide, 13, 'Evidence tools', 'GitHub and LinkedIn, with honest limits', 'External signals corroborate; they never become an automatic background check.')
  card(slide, { x: 0.62, y: 1.86, w: 5.82, h: 3.8, eyebrow: 'GITHUB PUBLIC API', title: 'Repository metadata for recruiter review', body: '• Candidate-provided handle or recruiter-confirmed search result\n• Public non-fork repository names, descriptions, languages and topics\n• Observable activity window and criterion signals\n• May raise one criterion by one step, capped at Supported\n\nDoes not prove identity, authorship, employment or proficiency.', fill: C.bluePale, accent: C.blue, icon: 'GH' })
  card(slide, { x: 6.73, y: 1.86, w: 5.98, h: 3.8, eyebrow: 'LINKEDIN CONSENT FLOW', title: 'Authorized evidence, never page scraping', body: '• Standard OIDC can confirm basic identity with consent\n• URL alone is not scraped\n• Candidate-authorized export/text can be compared\n• Advanced talent data requires LinkedIn approval\n\nDoes not claim that ordinary login provides complete employment or skills data.', fill: C.rosePale, accent: C.rose, icon: 'LI' })
  rounded(slide, 2.22, 5.83, 8.88, 0.38, C.white, C.line)
  addText(slide, 'External evidence never erases a contradiction and cannot create a Strong rating on its own.', 2.42, 5.89, 8.48, 0.2, { fontSize: 9.5, color: C.red, bold: true, align: 'center' })
  addCue(slide, 'Avoid saying “LinkedIn verifies every skill.” Say: “We support consented evidence within LinkedIn’s approved access.”')
  note(slide, 'GitHub gives us public repository metadata. It can corroborate a skill but cannot prove who wrote the code or where they worked. LinkedIn is more restricted. We do not scrape a profile URL. Standard OpenID Connect provides basic consented identity information, not complete employment and skills. For richer data, a production system would need approved LinkedIn partner access or candidate-authorized exports.')
}

// 14 — Multi-dimensional shortlist
{
  const slide = pptx.addSlide()
  addBase(slide, 14, 'Explainability', 'A shortlist without an opaque score', 'Recruiters compare dimensions instead of trusting a single number.')
  const headers = ['Candidate', 'Required', 'Evidence', 'Salary', 'Strengths', 'Trade-offs']
  const xs = [0.64, 2.55, 3.86, 5.25, 6.65, 9.43]
  const ws = [1.75, 1.16, 1.22, 1.22, 2.62, 2.66]
  rounded(slide, 0.62, 1.86, 12.08, 0.56, C.ink, C.ink)
  headers.forEach((h, i) => addText(slide, h.toUpperCase(), xs[i], 2.02, ws[i], 0.22, { fontSize: 7.5, color: C.white, bold: true, charSpacing: 0.7 }))
  const rows = [
    ['Maya Rao', '4/5', 'Strong', '+₹1L', 'Backend • cloud • reliability', 'No multi-region ownership'],
    ['Kabir Sen', '4/5', 'Strong', '+₹6L', 'Kubernetes • Terraform • tracing', 'Over level and salary'],
    ['Noor Khan', '3/5', 'Supported', 'At cap', 'Python • Pub/Sub • GCP', 'No production failover'],
    ['Leena Thomas', '2/5', 'Claim check', 'Within', 'Python API • Sentry', 'Expert claim lacks evidence'],
  ]
  rows.forEach((r, ri) => {
    const y = 2.51 + ri * 0.78
    const fill = ri % 2 === 0 ? C.white : 'F7F8F6'
    slide.addShape(pptx.ShapeType.rect, { x: 0.62, y, w: 12.08, h: 0.7, fill: { color: fill }, line: { color: C.line, width: 0.5 } })
    r.forEach((v, i) => addText(slide, v, xs[i], y + 0.13, ws[i], 0.39, { fontSize: i === 0 ? 10.5 : 9.2, color: i === 5 ? C.red : i === 4 ? C.moss : C.ink, bold: i === 0 || i === 1, valign: 'top' }))
  })
  rounded(slide, 1.48, 5.83, 10.38, 0.4, C.mint2, C.mint2)
  addText(slide, 'Ranking is navigation. The evidence cards, claim checks, and trade-offs are the actual decision support.', 1.7, 5.9, 9.94, 0.2, { fontSize: 9.8, color: C.mossDark, bold: true, align: 'center' })
  addCue(slide, 'When asked “who is best?”, answer with the role trade-off, not only the top row.')
  note(slide, 'Verity may order candidates to help the recruiter navigate, but it never hides the dimensions. The recruiter sees required areas met, evidence level, salary difference, documented experience, strengths, missing requirements and claim checks. The correct answer may be different depending on whether salary, experience, Kubernetes or learning potential matters most.')
}

// 15 — API and code map
{
  const slide = pptx.addSlide()
  addBase(slide, 15, 'Technical implementation', 'API endpoints and where the logic lives', 'Use this slide when faculty asks, “Show us the code.”')
  rounded(slide, 0.62, 1.84, 7.1, 4.35, C.white, C.line)
  addText(slide, 'EXPRESS API', 0.92, 2.1, 1.2, 0.22, { fontSize: 8, color: C.blue, bold: true, charSpacing: 1.1 })
  const apis = [
    ['GET', '/api/health', 'Model capability status'],
    ['POST', '/api/agent/screen', 'Run evidence-first agent workflow'],
    ['POST', '/api/agent/requisition-intelligence', 'Generate criteria and terminology'],
    ['POST', '/api/verify/github', 'Read public repository metadata'],
    ['POST', '/api/verify/github/search', 'Find candidate profiles for review'],
    ['POST', '/api/verify/linkedin', 'Compare authorized LinkedIn text'],
    ['GET', '/api/auth/linkedin/*', 'Consent-based OIDC flow'],
  ]
  apis.forEach((a, i) => {
    const y = 2.51 + i * 0.45
    pill(slide, a[0], 0.92, y, 0.58, a[0] === 'GET' ? C.mint2 : C.bluePale, a[0] === 'GET' ? C.moss : C.blue, 6.7)
    addText(slide, a[1], 1.66, y - 0.01, 3.26, 0.28, { fontFace: FONT_MONO, fontSize: 8.4, color: C.ink, bold: true })
    addText(slide, a[2], 4.98, y - 0.01, 2.36, 0.29, { fontSize: 8.8, color: C.muted })
  })
  rounded(slide, 7.96, 1.84, 4.74, 4.35, C.mint2, C.mint)
  addText(slide, 'CORE FILES', 8.26, 2.1, 1.0, 0.22, { fontSize: 8, color: C.moss, bold: true, charSpacing: 1.1 })
  const files = [
    ['src/screening.js', 'Evidence levels + confidence'],
    ['src/contradictions.js', 'Source-cited claim checks'],
    ['src/requisitionAnalysis.js', 'Pool conflicts + shortlist'],
    ['agent/orchestrator.js', 'Candidate LangChain graph'],
    ['agent/requirementIntelligence.js', 'Terminology generation graph'],
    ['server/index.js', 'API, validation and timeouts'],
    ['src/reportExport.js', 'Ten-sheet Excel workbook'],
  ]
  files.forEach((f, i) => {
    const y = 2.5 + i * 0.47
    addText(slide, f[0], 8.28, y, 2.12, 0.24, { fontFace: FONT_MONO, fontSize: 8, color: C.mossDark, bold: true })
    addText(slide, f[1], 10.45, y, 1.86, 0.28, { fontSize: 8.6, color: C.muted })
  })
  addCue(slide, 'The API is stateless; demo data persists in browser localStorage, not in a production database.')
  note(slide, 'This is the technical reference slide. The React client calls the Express endpoints. The screening endpoint runs the LangChain screening graph. The requisition-intelligence endpoint accepts only minimized job data. GitHub and LinkedIn have separate verification routes. The file list on the right shows faculty exactly where to look for each major behavior. The current hackathon version stores demo state in localStorage; a production version would use authenticated database storage.')
}

// 16 — Demo
{
  const slide = pptx.addSlide()
  addBase(slide, 16, 'Working demonstration', 'A seven-minute live demo script', 'Follow this sequence to prove both the base problem and the surprise challenges.')
  const steps = [
    ['00:00', 'Dashboard', 'Explain applicants, strong matches and claim checks.'],
    ['00:40', 'New role', 'Open requisition editor and paste a job description.'],
    ['01:20', 'Generate', 'Create a new terminology map and review related terms.'],
    ['02:10', 'Upload', 'Add a normal resume and one unsupported-claim resume.'],
    ['03:00', 'Evidence', 'Open a candidate and read the cited assessment passages.'],
    ['04:00', 'Challenge 01', 'Show the exact claim and conflicting or missing support.'],
    ['05:00', 'Challenge 02', 'Show pool coverage, conflicts and closest-fit trade-offs.'],
    ['06:10', 'Report', 'Export the Excel workbook and close with human review.'],
  ]
  steps.forEach((s, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = 0.62 + col * 6.08
    const y = 1.83 + row * 1.08
    rounded(slide, x, y, 5.79, 0.88, i % 3 === 0 ? C.mint2 : C.white, C.line)
    pill(slide, s[0], x + 0.18, y + 0.25, 0.7, C.ink, C.white, 6.6)
    addText(slide, s[1], x + 1.04, y + 0.14, 1.22, 0.26, { fontSize: 11.5, bold: true })
    addText(slide, s[2], x + 2.23, y + 0.13, 3.24, 0.48, { fontSize: 9.3, color: C.muted, valign: 'top' })
  })
  addCue(slide, 'Keep the demo evidence-led: after every click, say what source text or rule caused the result.')
  note(slide, 'Demo narration: Start on the dashboard and explain the three metrics. Open the requisition editor, choose Generate New Map, and show that the agent creates role-specific terms. Point out that related terms are not selected. Upload two resumes. Open the candidate details and read the cited evidence. Show Surprise Challenge 1 in claim checks. Show Surprise Challenge 2 in pool insights and the closest-fit shortlist. Finish by exporting the Excel workbook and stating that the recruiter makes the final decision.')
}

// 17 — Practical impact
{
  const slide = pptx.addSlide()
  addBase(slide, 17, 'Practical applicability', 'Where Verity creates value', 'A reusable first-review system for evidence-heavy recruiting.')
  metric(slide, 0.63, 1.87, 2.76, '10', 'Excel review sheets', C.moss, 'Evidence, gaps, checks and interviews')
  metric(slide, 3.58, 1.87, 2.76, '49/49', 'Automated tests passing', C.blue, 'Current project verification')
  metric(slide, 6.53, 1.87, 2.76, '0%', 'Fabricated evidence allowed', C.rose, 'Missing text remains missing')
  metric(slide, 9.48, 1.87, 2.76, 'HUMAN', 'Final decision owner', C.amber, 'Agent recommends; recruiter decides')
  const uses = [
    ['Campus hiring', 'Large junior pools with inconsistent resume language'],
    ['Startups', 'Lean recruiting teams that need explainable first review'],
    ['Agencies', 'Comparable candidate summaries across client requisitions'],
    ['Enterprise teams', 'Auditable evidence packets for structured review'],
  ]
  uses.forEach((u, i) => {
    const x = 0.63 + i * 3.0
    rounded(slide, x, 3.46, 2.74, 2.15, C.white, C.line)
    circle(slide, x + 0.22, 3.7, 0.38, [C.moss, C.blue, C.rose, C.amber][i], [C.moss, C.blue, C.rose, C.amber][i])
    addText(slide, String(i + 1), x + 0.22, 3.7, 0.38, 0.38, { fontSize: 9, color: C.white, bold: true, align: 'center' })
    addText(slide, u[0], x + 0.74, 3.68, 1.73, 0.28, { fontSize: 12, bold: true })
    addText(slide, u[1], x + 0.24, 4.37, 2.23, 0.76, { fontSize: 10.2, color: C.muted, valign: 'top', align: 'center' })
  })
  addCue(slide, 'Describe impact as better review quality and transparency, not guaranteed hiring accuracy.')
  note(slide, 'Verity is suitable for campus hiring, startups, agencies and larger recruiting teams. The practical value is faster organization of evidence, consistent application of criteria, and clearer human review. We do not claim that it predicts employee success or removes all bias. Its value is traceability: recruiters can see why a result exists and challenge it.')
}

// 18 — Challenges
{
  const slide = pptx.addSlide()
  addBase(slide, 18, 'Engineering lessons', 'Challenges faced and solutions implemented', 'Each difficult edge case became an explicit rule or product boundary.')
  const rows = [
    ['Unsupported resume claims', 'Evidence-quality ladder + zero confidence when no passage exists'],
    ['Equivalent terminology', 'Approved aliases + Requirement Intelligence Agent'],
    ['Conflicting statements', 'Source passages, timelines, offsets and confidence caps'],
    ['Impossible requisition', 'Pool coverage, structural conflicts and closest-fit shortlist'],
    ['LinkedIn restrictions', 'No scraping; consented OIDC and authorized evidence only'],
    ['Requisition changes', 'Clear stale criterion mappings before rescreening'],
    ['LLM uncertainty', 'Strict Zod output, policy filtering and recruiter approval'],
  ]
  rounded(slide, 0.62, 1.84, 12.08, 0.52, C.ink, C.ink)
  addText(slide, 'CHALLENGE', 0.94, 1.99, 3.4, 0.2, { fontSize: 8, color: C.white, bold: true, charSpacing: 1 })
  addText(slide, 'SOLUTION IMPLEMENTED', 4.64, 1.99, 7.42, 0.2, { fontSize: 8, color: C.white, bold: true, charSpacing: 1 })
  rows.forEach((r, i) => {
    const y = 2.44 + i * 0.5
    const fill = i % 2 ? 'F6F7F5' : C.white
    slide.addShape(pptx.ShapeType.rect, { x: 0.62, y, w: 12.08, h: 0.44, fill: { color: fill }, line: { color: C.line, width: 0.5 } })
    circle(slide, 0.92, y + 0.13, 0.16, [C.rose, C.blue, C.red, C.amber, C.blue, C.moss, C.rose][i], [C.rose, C.blue, C.red, C.amber, C.blue, C.moss, C.rose][i])
    addText(slide, r[0], 1.25, y + 0.05, 3.08, 0.3, { fontSize: 9.5, bold: true })
    addText(slide, r[1], 4.64, y + 0.05, 7.35, 0.3, { fontSize: 9.5, color: C.muted })
  })
  rounded(slide, 1.78, 5.98, 9.77, 0.33, C.amberPale, C.amberPale)
  addText(slide, 'Main lesson: model capability is useful only when its authority and failure modes are visible.', 2.0, 6.04, 9.32, 0.18, { fontSize: 9.2, color: C.amber, bold: true, align: 'center' })
  addCue(slide, 'If asked about limitations, answer honestly: hackathon persistence, model key, OAuth approval, OCR and fairness evaluation are production work.')
  note(slide, 'The hardest problems were not visual. They were trust boundaries. We had to distinguish missing evidence from contradiction, equivalent from merely related terminology, public activity from employment, and a useful recommendation from an automated decision. We turned each boundary into code, validation, confidence caps, or an explicit warning in the interface.')
}

// 19 — Future and close
{
  const slide = pptx.addSlide()
  addBase(slide, 19, 'Future scope', 'From hackathon prototype to production platform', 'The current architecture leaves clear extension points without changing its evidence-first principle.')
  const future = [
    ['1', 'Semantic retrieval', 'Embeddings to retrieve related evidence passages beyond exact aliases.'],
    ['2', 'Skill taxonomies', 'Approved occupational standards plus recruiter feedback.'],
    ['3', 'Document intelligence', 'OCR, multilingual resumes and better timeline extraction.'],
    ['4', 'Enterprise controls', 'Authentication, database storage, audit logs and ATS connectors.'],
    ['5', 'Responsible evaluation', 'Fairness tests, calibration studies and bias monitoring.'],
    ['6', 'Approved integrations', 'LinkedIn Talent Solutions and organization-authorized tools.'],
  ]
  future.forEach((f, i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    card(slide, { x: 0.62 + col * 4.1, y: 1.84 + row * 1.55, w: 3.83, h: 1.28, eyebrow: `NEXT ${f[0]}`, title: f[1], body: f[2], fill: row === 0 ? C.white : C.mint2, accent: [C.moss, C.blue, C.rose, C.amber, C.moss, C.blue][i], icon: f[0] })
  })
  rounded(slide, 1.16, 5.18, 11.0, 0.85, C.ink, C.ink)
  addText(slide, '“Verity does not ask whether a keyword exists. It asks whether the candidate provided evidence strong enough for a recruiter to trust the claim.”', 1.55, 5.35, 10.22, 0.44, { fontFace: FONT_HEAD, fontSize: 15, color: C.white, bold: true, align: 'center', italic: true })
  addCue(slide, 'Close: “We built a reviewer that can explain itself, admit uncertainty, and say when the job itself is the problem.”')
  note(slide, 'Closing: Verity can grow through semantic retrieval, approved skill taxonomies, OCR, multilingual processing, authenticated storage, ATS connections and fairness evaluation. But the core principle remains unchanged. The system must cite what it trusts, expose what it does not know, and leave the employment decision to a human. Thank you. We are ready for questions.')
}

pptx.writeFile({ fileName: 'Verity_PS02_Hackathon_Presentation.pptx' })
  .then(() => console.log('Created Verity_PS02_Hackathon_Presentation.pptx'))
  .catch((error) => { console.error(error); process.exitCode = 1 })

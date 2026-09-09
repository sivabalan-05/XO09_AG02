import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle, ArrowLeft, ArrowRight, BarChart3, Check, CheckCircle2, ChevronDown,
  CircleHelp, CloudUpload, FileText, Filter, LayoutDashboard, Menu, Pencil, Plus,
  Search, ShieldCheck, Sparkles, Target, Users, X, Zap, Download, RotateCcw, Trash2,
  Bot, GitBranch, Link2, ExternalLink, ShieldAlert, Workflow,
} from 'lucide-react'
import { defaultRequisition, sampleCandidates } from './data'
import { getPoolInsights, levelLabels, screenPool } from './screening'

const views = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'candidates', label: 'Candidates', icon: Users },
  { id: 'insights', label: 'Pool insights', icon: BarChart3 },
  { id: 'agent', label: 'Agent operations', icon: Bot },
]

function Avatar({ name, size = 'md' }) {
  const colors = ['moss', 'clay', 'navy', 'plum', 'ochre']
  const index = name.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0) % colors.length
  return <span className={`avatar ${colors[index]} ${size}`}>{name.split(' ').map((p) => p[0]).join('').slice(0, 2)}</span>
}

function LevelPill({ level, compact = false }) {
  return <span className={`level-pill ${level} ${compact ? 'compact' : ''}`}><span />{levelLabels[level]}</span>
}

const STORAGE = { candidates: 'verity:candidates:v2', requisition: 'verity:requisition:v2' }
const AGENT_API = import.meta.env.VITE_AGENT_API_URL || 'http://127.0.0.1:8787'
const localAgentFallback = (candidate) => {
  const recommendation = candidate.flags.some((flag) => flag.kind === 'contradictory')
    ? 'Hold for human validation'
    : candidate.requiredStrong >= 3 ? 'Shortlist for recruiter review' : 'Keep in reviewed pool'
  return {
    mode: 'local-policy-fallback', recommendation, narrative: null, modelStatus: 'Agent API unavailable — deterministic local policy used.',
    trace: [
      { step: 'Application intake', status: 'complete', detail: 'Source application retained in this browser.' },
      { step: 'Evidence & contradiction review', status: 'complete', detail: `${candidate.assessments.length} criteria assessed; ${candidate.flags.length} claim check(s) cited.` },
      { step: 'Human-review decision', status: 'complete', detail: `${recommendation}. This is not an automated hiring decision.` },
    ],
  }
}
function readStored(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback } catch { return fallback }
}

function Modal({ children, onClose, wide = false, label = 'Dialog' }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href]')
        if (!focusable?.length) return
        const first = focusable[0], last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    const frame = requestAnimationFrame(() => dialogRef.current?.querySelector('button, input, textarea, select')?.focus())
    return () => { document.removeEventListener('keydown', onKey); cancelAnimationFrame(frame) }
  }, [onClose])
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={label}>{children}</div>
    </div>
  )
}

function Topbar({ view, openUpload, openHelp, onExport, mobileOpen, setMobileOpen }) {
  return (
    <header className="topbar">
      <button className="icon-button mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Open navigation"><Menu size={20} /></button>
      <div className="crumb"><span>Requisitions</span><span>/</span><strong>{view === 'overview' ? 'JR-2048' : views.find((v) => v.id === view)?.label}</strong></div>
      <div className="top-actions">
        <button className="text-button help" onClick={openHelp}><CircleHelp size={17} /> How scoring works</button>
        <button className="text-button export-button" onClick={onExport}><Download size={17} /> Export report</button>
        <button className="primary-button" onClick={openUpload}><Plus size={17} /> Add applicants</button>
      </div>
    </header>
  )
}

function Sidebar({ view, setView, mobileOpen, setMobileOpen }) {
  return (
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
      <div className="brand"><span className="brand-mark"><ShieldCheck size={20} strokeWidth={2.5} /></span><span>verity</span></div>
      <nav>
        <p className="nav-label">Workspace</p>
        {views.map(({ id, label, icon: Icon }) => (
          <button key={id} className={view === id ? 'active' : ''} onClick={() => { setView(id); setMobileOpen(false) }}>
            <Icon size={18} /> {label}
          </button>
        ))}
      </nav>
      <div className="sidebar-note">
        <span><Sparkles size={15} /> Evidence-first</span>
        <p>Every assessment stays traceable to the source application.</p>
      </div>
      <div className="user-row"><Avatar name="Siva Balan" size="sm" /><span><strong>Siva Balan</strong><small>Hiring team</small></span><ChevronDown size={15} /></div>
    </aside>
  )
}

function RequisitionHeader({ requisition, screened, onEdit, onFilter }) {
  const strong = screened.filter((c) => ['Leading match', 'Strong match'].includes(c.band)).length
  return (
    <section className="req-header">
      <div className="eyebrow-row"><span className="status-dot">Active</span><span>JR-2048</span><span>Created 08 Sep 2026</span></div>
      <div className="req-title-row">
        <div><h1>{requisition.title}</h1><p>{requisition.team}</p></div>
        <button className="secondary-button" onClick={onEdit}><Pencil size={16} /> Edit requisition</button>
      </div>
      <div className="req-meta">
        <button onClick={() => onFilter('all')}><Users size={16} /><strong>{screened.length}</strong> applicants</button>
        <button onClick={() => onFilter('leading')}><Target size={16} /><strong>{strong}</strong> strong matches</button>
        <button onClick={() => onFilter('flagged')}><AlertCircle size={16} /><strong>{screened.reduce((n, c) => n + c.flags.length, 0)}</strong> claim checks</button>
      </div>
    </section>
  )
}

function CandidateRow({ candidate, rank, onOpen, selected, onSelect }) {
  const required = candidate.assessments.filter((a) => a.criterionId !== 'iac' && a.criterionId !== 'collaboration')
  return (
    <div className="candidate-row">
      <button className="candidate-main" onClick={() => onOpen(candidate)} aria-label={`Open evidence assessment for ${candidate.name}`}>
      <span className="rank">{String(rank).padStart(2, '0')}</span>
      <span className="candidate-identity"><Avatar name={candidate.name} /><span><strong>{candidate.name}</strong><small>{candidate.id} · {candidate.role}</small></span></span>
      <span className="fit-with-flags"><span className={`band ${candidate.band.toLowerCase().replaceAll(' ', '-')}`}>{candidate.band}</span>{candidate.flags.length > 0 && <small className="claim-check-badge"><AlertCircle size={11} /> {candidate.flags.length} claim check{candidate.flags.length === 1 ? '' : 's'}</small>}</span>
      <span className="evidence-dots" aria-label={`${candidate.requiredStrong} required criteria supported`}>
        {required.map((a) => <i key={a.criterionId} className={a.level} title={levelLabels[a.level]} />)}
      </span>
      <span className="coverage"><strong>{candidate.requiredStrong}/{candidate.requiredTotal}</strong><small>required strong</small></span>
      <span className="confidence"><strong>{candidate.confidence}%</strong><small>confidence</small></span>
      <span className="row-arrow"><ArrowRight size={17} /></span>
      </button>
      <label className="select-wrap" aria-label={`Select ${candidate.name} for comparison`}>
        <input className="visually-hidden" type="checkbox" checked={selected} onChange={() => onSelect(candidate.id)} />
        <span className={`compare-check ${selected ? 'checked' : ''}`} aria-hidden="true">{selected && <Check size={13} />}</span>
      </label>
    </div>
  )
}

function PoolGap({ insight, poolSize }) {
  return (
    <div className="gap-banner">
      <span className="gap-icon"><AlertCircle size={20} /></span>
      <div><span className="overline">POOL-WIDE GAP</span><h3>{insight.name}</h3><p>No applicant fully demonstrates the required ownership and scale. Consider reframing this as preferred, expanding the level, or planning to develop it after hire.</p></div>
      <span className="gap-count">0/{poolSize}<small>fully meet</small></span>
    </div>
  )
}

function Overview({ screened, insights, onOpen, onNavigate, onFilter, selected, onSelect }) {
  const top = screened.slice(0, 5)
  const poolGap = insights.find((i) => i.isGap)
  const strongCount = screened.filter((c) => ['Leading match', 'Strong match'].includes(c.band)).length
  return (
    <div className="page-content">
      <div className="section-heading"><div><span className="overline">SCREENING COMPLETE</span><h2>Evidence, not adjectives.</h2><p>The shortlist prioritizes demonstrated work while keeping each candidate’s trade-offs visible.</p></div><span className="audit-badge"><CheckCircle2 size={16} /> {screened.length} applications analyzed</span></div>
      <section className="metric-grid" aria-label="Screening summary actions">
        <button className="metric-block" onClick={() => onFilter('leading')}><span>Leading candidates</span><strong>{strongCount}</strong><p>View candidates with strong evidence</p></button>
        <button className="metric-block" onClick={() => onNavigate('insights')}><span>Evidence coverage</span><strong>{Math.round(screened.reduce((s, c) => s + c.evidenceCoverage, 0) / screened.length)}%</strong><p>View evidence across all criteria</p></button>
        <button className="metric-block warning" onClick={() => onFilter('flagged')}><span>Claims to validate</span><strong>{screened.reduce((n, c) => n + c.flags.length, 0)}</strong><p>Open applications requiring review</p></button>
        <button className="metric-block critical" onClick={() => onNavigate('insights')}><span>Pool-wide gaps</span><strong>{insights.filter((i) => i.isGap).length}</strong><p>Review unmet required criteria</p></button>
      </section>
      {poolGap && <PoolGap insight={poolGap} poolSize={screened.length} />}
      <section className="panel shortlist-panel">
        <div className="panel-heading"><div><h3>Evidence-led shortlist</h3><p>Ordered by fit band, required coverage, then evidence depth.</p></div><button className="text-link" onClick={() => onNavigate('candidates')}>View all candidates <ArrowRight size={15} /></button></div>
        <div className="table-head"><span>#</span><span>Candidate</span><span>Fit band</span><span>Required evidence</span><span>Coverage</span><span>Confidence</span><span></span><span>Compare</span></div>
        <div className="candidate-list">{top.map((candidate, index) => <CandidateRow key={candidate.id} candidate={candidate} rank={index + 1} onOpen={onOpen} selected={selected.includes(candidate.id)} onSelect={onSelect} />)}</div>
      </section>
      <section className="tradeoff-section">
        <div className="panel-heading"><div><span className="overline">WHY THESE CANDIDATES</span><h3>Different strengths, honest trade-offs</h3></div></div>
        <div className="tradeoff-grid">{top.slice(0, 3).map((candidate, index) => (
          <button key={candidate.id} onClick={() => onOpen(candidate)} className="tradeoff-card">
            <span className="card-number">0{index + 1}</span><Avatar name={candidate.name} /><div><h4>{candidate.name}</h4><p className="strength-copy"><CheckCircle2 size={15} /> {candidate.strength}</p><p className="trade-copy"><AlertCircle size={15} /> {candidate.tradeoff}</p></div>
          </button>
        ))}</div>
      </section>
    </div>
  )
}

function Candidates({ screened, onOpen, selected, onSelect, filterMode, clearFilter }) {
  const [query, setQuery] = useState('')
  const [band, setBand] = useState('All fit bands')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const filtered = screened.filter((c) => (c.name + c.role + c.id).toLowerCase().includes(query.toLowerCase()) && (band === 'All fit bands' || c.band === band) && (!flaggedOnly || c.flags.length > 0) && (filterMode !== 'leading' || ['Leading match', 'Strong match'].includes(c.band)) && (filterMode !== 'flagged' || c.flags.length > 0))
  return (
    <div className="page-content candidates-page">
      <div className="section-heading"><div><span className="overline">APPLICANT POOL</span><h2>Candidate evidence matrix</h2><p>Open any application to trace assessments back to exact resume evidence.</p></div></div>
      <div className="filter-bar"><label className="search-box"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search candidates or roles" /></label><label className="select-box"><Filter size={16} /><select value={band} onChange={(e) => setBand(e.target.value)}><option>All fit bands</option><option>Leading match</option><option>Strong match</option><option>Promising match</option><option>Developing match</option></select></label><span className="result-count">{filtered.length} candidates</span>{filterMode !== 'all' && <button className="active-filter" onClick={clearFilter}>Showing {filterMode === 'flagged' ? 'claim checks' : 'strong matches'} <X size={13} /></button>}</div>
      <label className="flag-filter"><input type="checkbox" checked={flaggedOnly} onChange={(event) => setFlaggedOnly(event.target.checked)} /> Only candidates with claim checks</label>
      <section className="panel shortlist-panel full-list">
        <div className="table-head"><span>#</span><span>Candidate</span><span>Fit band</span><span>Required evidence</span><span>Coverage</span><span>Confidence</span><span></span><span>Compare</span></div>
        <div className="candidate-list">{filtered.map((candidate) => <CandidateRow key={candidate.id} candidate={candidate} rank={screened.indexOf(candidate) + 1} onOpen={onOpen} selected={selected.includes(candidate.id)} onSelect={onSelect} />)}</div>
        {!filtered.length && <div className="empty-state"><Search size={25} /><h3>No candidates found</h3><p>Try a different name, role, or fit band.</p></div>}
      </section>
    </div>
  )
}

function Insights({ insights, screened }) {
  return (
    <div className="page-content">
      <div className="section-heading"><div><span className="overline">REQUISITION HEALTH</span><h2>What this applicant pool can actually support</h2><p>Coverage is based on concrete evidence—not the frequency of matching keywords.</p></div></div>
      {insights.filter((i) => i.isGap).map((insight) => <PoolGap key={insight.id} insight={insight} poolSize={screened.length} />)}
      <section className="panel coverage-panel">
        <div className="panel-heading"><div><h3>Criterion coverage</h3><p>Applicants with supported or strong evidence for each criterion.</p></div><span className="legend"><i className="supported" /> Supported <i className="partial" /> Partial <i className="missing" /> Missing / claim-only</span></div>
        <div className="coverage-list">{insights.map((insight) => {
          const missing = screened.length - insight.strong - insight.partial
          return (
            <div className="coverage-row" key={insight.id}>
              <div className="coverage-label"><span><strong>{insight.name}</strong><small>{insight.type}{insight.stretch ? ' · stretch requirement' : ''}</small></span><b>{insight.coverage}%</b></div>
              <div className="stacked-bar" aria-label={`${insight.strong} supported, ${insight.partial} partial, ${missing} missing`}><i className="supported" style={{ width: `${insight.strong / screened.length * 100}%` }} /><i className="partial" style={{ width: `${insight.partial / screened.length * 100}%` }} /><i className="missing" style={{ width: `${missing / screened.length * 100}%` }} /></div>
              <div className="coverage-counts"><span>{insight.strong} supported</span><span>{insight.partial} partial</span><span>{missing} missing/claim-only</span></div>
            </div>
          )
        })}</div>
      </section>
      <div className="method-note"><ShieldCheck size={20} /><div><h3>Transparent by design</h3><p>Equivalent terms map to the same criterion (for example, Pub/Sub and Kafka both support event-driven systems). Confidence rises only when a term appears with an action, context, and ideally a measurable outcome. The application is the sole evidence source.</p></div></div>
    </div>
  )
}

function CandidateDetail({ candidate, requisition, onClose, onRemove, onVerify, onRunAgent }) {
  const [tab, setTab] = useState('assessment')
  const [sourceLine, setSourceLine] = useState(null)
  const showSource = (reference) => { setSourceLine(reference.line); setTab('source') }
  useEffect(() => {
    if (tab === 'source' && sourceLine) document.getElementById(`source-line-${sourceLine}`)?.scrollIntoView({ block: 'center' })
  }, [tab, sourceLine])
  return (
    <Modal onClose={onClose} wide>
      <div className="detail-header"><button className="icon-button" onClick={onClose} aria-label="Close candidate assessment"><ArrowLeft size={20} /></button><div className="detail-person"><Avatar name={candidate.name} /><div><span className="overline">{candidate.id} · {candidate.source}</span><h2>{candidate.name}</h2><p>{candidate.role}</p></div></div><span className={`band ${candidate.band.toLowerCase().replaceAll(' ', '-')}`}>{candidate.band}</span><button className="icon-button" onClick={onRunAgent} aria-label={`Run LangChain evidence review for ${candidate.name}`} title="Run LangChain evidence review"><Bot size={18} /></button><button className="icon-button" onClick={onVerify} aria-label={`Verify external evidence for ${candidate.name}`} title="Review consented external evidence"><ShieldCheck size={18} /></button><button className="icon-button remove-candidate" onClick={onRemove} aria-label={`Remove ${candidate.name}`} title="Remove from local pool"><Trash2 size={18} /></button><button className="icon-button close" onClick={onClose} aria-label="Close candidate assessment"><X size={20} /></button></div>
      <div className="detail-summary"><div><span>Required areas</span><strong>{candidate.requiredStrong} of {candidate.requiredTotal} strong</strong></div><div><span>Evidence coverage</span><strong>{candidate.evidenceCoverage}%</strong></div><div><span>Assessment confidence</span><strong>{candidate.confidence}%</strong></div><div className={candidate.unsupportedCount ? 'warn' : ''}><span>Unsupported claims</span><strong>{candidate.unsupportedCount}</strong></div></div>
      <div className="detail-tabs"><button className={tab === 'assessment' ? 'active' : ''} onClick={() => setTab('assessment')}>Criterion assessment</button><button className={tab === 'source' ? 'active' : ''} onClick={() => setTab('source')}>Source application</button></div>
      <div className="detail-body">
        {tab === 'assessment' ? <>
          <section className="claim-checks" aria-label="Contradiction and unsupported claim checks">
            <div className="agent-status-card"><Bot size={18} /><div><strong>{candidate.agentReview?.mode === 'local-policy-fallback' ? 'Local policy review completed' : `LangChain review ${candidate.agentReview ? 'completed' : 'available'}`}</strong><p>{candidate.agentReview?.recommendation || 'Run the agent to create an auditable execution trace and a human-review recommendation.'}</p>{candidate.agentReview?.narrative && <small>{candidate.agentReview.narrative}</small>}{candidate.agentReview?.modelStatus && <small>{candidate.agentReview.modelStatus}</small>}</div><button className="secondary-button" onClick={onRunAgent}>{candidate.agentReview ? 'Run again' : 'Run agent'}</button></div>
            {candidate.verification && <div className="verification-mini"><ShieldCheck size={16} /><span><strong>External evidence:</strong> {Object.values(candidate.verification).filter(Boolean).map((item) => `${item.provider} · ${item.status}`).join(' · ') || 'No verified source'}</span><button onClick={onVerify}>Review</button></div>}
            <h3>Application consistency · {candidate.flags.length} flag{candidate.flags.length === 1 ? '' : 's'}</h3>
            <p className="checks-explanation">{candidate.flags.length ? `Confidence reduced by ${candidate.confidenceReduction} percentage points. These checks identify conflicts or missing support, not dishonesty. Percentages are heuristic indicators, not calibrated probabilities.` : 'No conflict detected by the available checks. This does not verify every claim in the application.'}</p>
            {candidate.flags.map((flag) => <article className={`claim-flag ${flag.kind}`} key={flag.id}>
              <span className="flag-kind"><AlertCircle size={14} /> {flag.kind === 'contradictory' ? 'CONTRADICTORY CLAIM' : 'UNSUPPORTED CLAIM'}</span>
              <h4>{flag.rule === 'duration' ? 'Claimed experience vs. documented dates' : flag.rule === 'title-scope' ? 'Title vs. described responsibilities' : flag.rule === 'expertise' ? 'Claimed expertise vs. supporting examples' : 'Conflicting application passages'}</h4>
              <strong className="reference-label">Claim</strong><blockquote>{flag.claim.quote}</blockquote>
              <button className="source-reference" onClick={() => showSource(flag.claim)}>{flag.claim.section} · line {flag.claim.line} <ArrowRight size={12} /></button>
              <strong className="reference-label">Evidence reviewed</strong>
              {flag.evidence.length ? flag.evidence.map((ref) => <div key={ref.start}><blockquote>{ref.quote}</blockquote><button className="source-reference" onClick={() => showSource(ref)}>{ref.section} · line {ref.line} <ArrowRight size={12} /></button></div>) : <p>No separate supporting passage was found. Only the claim above is present.</p>}
              <p className="flag-assessment"><strong>Assessment: </strong>{flag.assessment}</p>
              <small>Confidence in affected criteria is capped at {flag.confidenceCap}% pending validation.</small>
            </article>)}
          </section>
          <div className="assessment-intro"><h3>Fit is multi-dimensional</h3><p><strong>Strength:</strong> {candidate.strength}. <strong>Trade-off:</strong> {candidate.tradeoff}.</p></div>
          <div className="assessment-list">{candidate.assessments.map((assessment) => {
            const criterion = requisition.criteria.find((c) => c.id === assessment.criterionId)
            return (
              <article className={`assessment-item ${assessment.level}`} key={assessment.criterionId}>
                <div className="assessment-title"><span><small>{criterion.type}{criterion.stretch ? ' · stretch' : ''}</small><h4>{criterion.name}</h4></span><LevelPill level={assessment.level} /></div>
                <p className="assessment-reason">{assessment.reason}</p>
                {assessment.evidence.length ? <div className="evidence-box"><span>Evidence found</span>{assessment.evidence.map((line, i) => <blockquote key={i}>“{line}”</blockquote>)}{assessment.terms.length > 0 && <small>Equivalent terms recognized: {assessment.terms.join(', ')}</small>}</div> : <div className="no-evidence"><AlertCircle size={15} /> No supporting passage found in this application.</div>}
                <div className="confidence-line"><span>Assessment confidence</span><div><i style={{ width: `${assessment.confidence}%` }} /></div><b>{assessment.confidence}%</b></div>
              </article>
            )
          })}</div>
        </> : <pre className="resume-source numbered-source">{candidate.text.split('\n').map((line, index) => <span id={`source-line-${index + 1}`} className={sourceLine === index + 1 ? 'highlighted-source' : ''} key={index}><small aria-hidden="true">{index + 1}</small>{line || ' '}{'\n'}</span>)}</pre>}
      </div>
    </Modal>
  )
}

async function extractFileText(file) {
  const extension = file.name.split('.').pop().toLowerCase()
  if (extension === 'txt' || extension === 'md') return file.text()
  if (extension === 'pdf') {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString()
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
    const pages = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const content = await (await pdf.getPage(i)).getTextContent()
      pages.push(content.items.map((item) => (item.str || '') + (item.hasEOL ? '\n' : ' ')).join(''))
    }
    return pages.join('\n')
  }
  if (extension === 'docx') {
    const mammoth = await import('mammoth/mammoth.browser')
    return (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value
  }
  throw new Error(`${file.name}: unsupported file type`)
}

function UploadModal({ onClose, onAdd, candidateCount }) {
  const [files, setFiles] = useState([])
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef()
  const addFiles = (incoming) => setFiles((current) => [...current, ...Array.from(incoming).filter((file) => /\.(pdf|docx|txt|md)$/i.test(file.name))])
  const submit = async () => {
    if (!files.length && !text.trim()) { setError('Add at least one resume file or paste application text.'); return }
    if (files.length > 1 && text.trim()) { setError('Attach a cover note with one resume at a time so evidence stays associated with the correct applicant.'); return }
    setBusy(true); setError('')
    try {
      const candidates = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const fileText = await extractFileText(file)
        if (!fileText.trim()) throw new Error(`${file.name}: no readable text found. Paste the resume text to evaluate a scanned document.`)
        const fallback = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
        const firstLine = fileText.split('\n').find((line) => line.trim().length > 2)?.trim()
        candidates.push({ id: `A-${String(candidateCount + candidates.length + 1).padStart(2, '0')}`, name: (files.length === 1 && name.trim()) || firstLine?.slice(0, 45) || fallback, role: 'New applicant', source: 'Upload', text: fileText + (text.trim() ? `\n\nCOVER NOTE\n${text.trim()}` : '') })
      }
      if (text.trim() && !files.length) candidates.push({ id: `A-${String(candidateCount + candidates.length + 1).padStart(2, '0')}`, name: name.trim() || 'Pasted applicant', role: 'New applicant', source: 'Pasted text', text })
      onAdd(candidates)
    } catch (err) { setError(err.message || 'Could not read that application.'); setBusy(false) }
  }
  return (
    <Modal onClose={onClose}>
      <div className="modal-header"><div><span className="overline">NEW SCREENING</span><h2>Add applications</h2><p>Upload resumes or paste application text. Files are analyzed locally in this demo.</p></div><button className="icon-button" onClick={onClose}><X size={20} /></button></div>
      <div className="upload-body">
        <button className={`dropzone ${dragging ? 'dragging' : ''}`} onClick={() => fileRef.current.click()} onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}>
          <CloudUpload size={28} /><strong>Drop resumes here, or click to browse</strong><span>PDF, DOCX, TXT, or MD · multiple files supported</span><input ref={fileRef} type="file" hidden multiple accept=".pdf,.docx,.txt,.md" onChange={(e) => addFiles(e.target.files)} />
        </button>
        {files.length > 0 && <div className="file-list">{files.map((file, i) => <div key={`${file.name}-${i}`}><FileText size={16} /><span>{file.name}<small>{Math.max(1, Math.round(file.size / 1024))} KB</small></span><button onClick={() => setFiles(files.filter((_, idx) => idx !== i))}><X size={15} /></button></div>)}</div>}
        <div className="or"><span>or paste application text</span></div>
        <label className="field"><span>Candidate name <small>optional</small></span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya Nair" /></label>
        <label className="field"><span>{files.length ? 'Cover note for the uploaded resume (optional)' : 'Resume + cover note'}</span><textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={files.length ? 'Paste this applicant’s cover note to cross-check it against their resume…' : 'Paste the complete application here…'} rows={7} /></label>
        {error && <div className="form-error"><AlertCircle size={16} />{error}</div>}
      </div>
      <div className="modal-footer"><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy} onClick={submit}>{busy ? <><span className="spinner" /> Reading applications…</> : <><Zap size={17} /> Screen applications</>}</button></div>
    </Modal>
  )
}

function EditRequisition({ requisition, onClose, onSave }) {
  const [draft, setDraft] = useState(() => structuredClone(requisition))
  const updateCriterion = (index, field, value) => setDraft({ ...draft, criteria: draft.criteria.map((c, i) => i === index ? { ...c, [field]: value } : c) })
  return (
    <Modal onClose={onClose} wide>
      <div className="modal-header"><div><span className="overline">JR-2048</span><h2>Edit requisition criteria</h2><p>Assessments refresh immediately after you save.</p></div><button className="icon-button" onClick={onClose}><X size={20} /></button></div>
      <div className="edit-body"><div className="edit-top"><label className="field"><span>Role title</span><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label><label className="field"><span>Team & location</span><input value={draft.team} onChange={(e) => setDraft({ ...draft, team: e.target.value })} /></label></div><p className="edit-helper">Aliases let equivalent wording count toward the same skill. Separate terms with commas.</p><div className="criteria-editor">{draft.criteria.map((criterion, index) => <div className="criterion-edit" key={criterion.id}><span className={`criterion-type ${criterion.type}`}>{criterion.type}</span><div><input className="criterion-name-input" value={criterion.name} onChange={(e) => updateCriterion(index, 'name', e.target.value)} /><textarea rows={2} value={criterion.description} onChange={(e) => updateCriterion(index, 'description', e.target.value)} /><label><span>Equivalent terms</span><input value={criterion.aliases.join(', ')} onChange={(e) => updateCriterion(index, 'aliases', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} /></label></div></div>)}</div></div>
      <div className="modal-footer"><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" onClick={() => onSave(draft)}><Check size={17} /> Save & rescreen</button></div>
    </Modal>
  )
}

function CompareModal({ candidates, requisition, onClose, onOpen }) {
  return <Modal onClose={onClose} wide><div className="modal-header"><div><span className="overline">SIDE-BY-SIDE</span><h2>Candidate trade-offs</h2><p>Compare evidence by criterion. No composite score hides the differences.</p></div><button className="icon-button" onClick={onClose}><X size={20} /></button></div><div className="compare-matrix"><div className="compare-grid compare-head"><span>Criterion</span>{candidates.map((candidate) => <button key={candidate.id} onClick={() => onOpen(candidate)}><Avatar name={candidate.name} size="sm" /><span><strong>{candidate.name}</strong><small>{candidate.band}</small></span></button>)}</div>{requisition.criteria.map((criterion) => <div className="compare-grid" key={criterion.id}><span className="matrix-criterion"><strong>{criterion.name}</strong><small>{criterion.type}</small></span>{candidates.map((candidate) => { const item = candidate.assessments.find((a) => a.criterionId === criterion.id); return <div className="matrix-cell" key={candidate.id}><LevelPill level={item.level} compact /><p>{item.evidence[0] || 'No supporting passage found.'}</p></div> })}</div>)}</div><div className="modal-footer"><button className="primary-button" onClick={onClose}>Done comparing</button></div></Modal>
}

function CompareTray({ selected, screened, onClear, onOpen, onCompare }) {
  if (!selected.length) return null
  const people = selected.map((id) => screened.find((c) => c.id === id)).filter(Boolean)
  return <div className="compare-tray"><div className="compare-people">{people.map((person) => <button key={person.id} onClick={() => onOpen(person)}><Avatar name={person.name} size="sm" /><span>{person.name.split(' ')[0]}</span></button>)}</div><span>{people.length}/3 selected</span>{people.length > 1 && <button className="tray-primary" onClick={onCompare}>Compare</button>}<button className="secondary-button" onClick={onClear}>Clear</button></div>
}

function HelpModal({ onClose }) {
  return <Modal onClose={onClose} wide label="How Verity scoring works">
    <div className="modal-header"><div><span className="overline">GUIDE</span><h2>How the screening works</h2><p>Every result is based on text present in the submitted application.</p></div><button className="icon-button" onClick={onClose} aria-label="Close guide"><X size={20} /></button></div>
    <div className="help-body">
      <section><span className="help-step">1</span><div><h3>Match equivalent terms</h3><p>Criteria use aliases, so Kafka, Pub/Sub and RabbitMQ can all support distributed-systems experience.</p></div></section>
      <section><span className="help-step">2</span><div><h3>Check evidence quality</h3><p>Action verbs, operating context and measurable outcomes strengthen evidence. A skills list or course alone does not carry the same weight.</p></div></section>
      <section><span className="help-step">3</span><div><h3>Check application consistency</h3><p>Claims are compared with dates, responsibilities and cover-note statements. Flags quote the exact passages reviewed and are not a finding of dishonesty.</p></div></section>
      <section><span className="help-step">4</span><div><h3>Show trade-offs and pool gaps</h3><p>Ranking stays explainable. Candidate comparison and pool insights show strengths, gaps and requirements no applicant fully meets.</p></div></section>
      <div className="help-note"><ShieldCheck size={18} /><p>Confidence reflects support in the submitted application, not the probability that a candidate is truthful. Human review remains the final decision.</p></div>
    </div>
    <div className="modal-footer"><button className="primary-button" onClick={onClose}>Got it</button></div>
  </Modal>
}

function VerificationModal({ candidate, requisition, onClose, onSave }) {
  const [githubUrl, setGithubUrl] = useState(candidate.verification?.github?.profile?.url || '')
  const [linkedinUrl, setLinkedinUrl] = useState(candidate.verification?.linkedin?.url || '')
  const [linkedinText, setLinkedinText] = useState('')
  const [githubResult, setGithubResult] = useState(candidate.verification?.github || null)
  const [linkedinResult, setLinkedinResult] = useState(candidate.verification?.linkedin || null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const request = async (path, body) => {
    const response = await fetch(`${AGENT_API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || 'The verification service is unavailable. Start the app with npm run dev:full.')
    return response.json()
  }
  const checkGitHub = async () => {
    setBusy('github'); setError('')
    try { const result = await request('/api/verify/github', { profileUrl: githubUrl, requisition }); setGithubResult(result); onSave({ github: result }) }
    catch (err) { setError(err.message) } finally { setBusy('') }
  }
  const checkLinkedIn = async () => {
    setBusy('linkedin'); setError('')
    try { const result = await request('/api/verify/linkedin', { url: linkedinUrl, authorizedText: linkedinText, requisition }); setLinkedinResult(result); onSave({ linkedin: result }) }
    catch (err) { setError(err.message) } finally { setBusy('') }
  }
  const renderResult = (result) => result && <div className={`provider-result ${result.status}`}><strong>{result.provider} · {result.status.replaceAll('-', ' ')}</strong><p>{result.message || result.disclaimer}</p>{result.profile && <p>Profile: <a href={result.profile.url} target="_blank" rel="noreferrer">@{result.profile.handle} <ExternalLink size={12} /></a> · {result.profile.publicRepos} public repos</p>}{result.evidence?.length > 0 && <ul>{result.evidence.slice(0, 4).map((item, index) => <li key={item.url || index}>{typeof item === 'string' ? item : <a href={item.url} target="_blank" rel="noreferrer">{item.name} · {item.language} <ExternalLink size={11} /></a>}</li>)}</ul>}{result.criteriaSignals?.length > 0 && <p><strong>Terminology signals to review:</strong> {[...new Set(result.criteriaSignals.map((signal) => signal.criterion))].join(', ')}. These are not proficiency scores.</p>}</div>
  return <Modal onClose={onClose} wide label="External evidence review"><div className="modal-header"><div><span className="overline">CONSENT-BASED VERIFICATION</span><h2>External evidence review</h2><p>For {candidate.name}. Findings are separate from the application fit score until reviewed by a person.</p></div><button className="icon-button" onClick={onClose} aria-label="Close verification"><X size={20} /></button></div><div className="verification-body"><section className="provider-card"><div><GitBranch size={21} /><div><h3>GitHub public evidence</h3><p>Read-only public profile and repository metadata. It cannot prove authorship, skill level or employment.</p></div></div><label className="field"><span>Candidate-provided GitHub profile</span><input value={githubUrl} onChange={(event) => setGithubUrl(event.target.value)} placeholder="https://github.com/username" /></label><button className="secondary-button" disabled={busy === 'github'} onClick={checkGitHub}>{busy === 'github' ? 'Checking…' : 'Review public GitHub'}</button>{renderResult(githubResult)}</section><section className="provider-card"><div><Link2 size={21} /><div><h3>LinkedIn authorized evidence</h3><p>No profile scraping. Use a candidate-authorized export here, or replace this adapter with your organization’s approved LinkedIn integration.</p></div></div><label className="field"><span>Public profile link <small>optional</small></span><input value={linkedinUrl} onChange={(event) => setLinkedinUrl(event.target.value)} placeholder="https://www.linkedin.com/in/..." /></label><label className="field"><span>Candidate-authorized profile export</span><textarea rows={5} value={linkedinText} onChange={(event) => setLinkedinText(event.target.value)} placeholder="Paste experience or project text the candidate has authorized you to use…" /></label><button className="secondary-button" disabled={busy === 'linkedin'} onClick={checkLinkedIn}>{busy === 'linkedin' ? 'Comparing…' : 'Compare authorized export'}</button>{renderResult(linkedinResult)}</section>{error && <div className="form-error"><AlertCircle size={16} />{error}</div>}<div className="consent-note"><ShieldAlert size={18} /><p>Recruiter safeguard: never use protected characteristics, inferred identity, network connections, or private data in the fit assessment. These providers are evidence sources for human review—not automatic background checks.</p></div></div><div className="modal-footer"><button className="primary-button" onClick={onClose}>Done</button></div></Modal>
}

function AgentOperations({ screened, onOpen, onRun, busy }) {
  const completed = screened.filter((candidate) => candidate.agentReview).length
  const queued = screened.filter((candidate) => !candidate.agentReview).length
  return <div className="page-content"><div className="section-heading"><div><span className="overline">LANGCHAIN ORCHESTRATION</span><h2>Autonomous, reviewable screening runs</h2><p>Every run follows a fixed evidence-first workflow; humans retain the hiring decision.</p></div><span className="audit-badge"><Workflow size={16} /> {completed} auditable runs</span></div><div className="agent-architecture"><article><span>01</span><h3>Intake node</h3><p>Retains resume and cover-note source text; no hidden enrichment.</p></article><article><span>02</span><h3>Evidence node</h3><p>Maps aliases, scores support, and cites contradictions.</p></article><article><span>03</span><h3>Policy node</h3><p>Produces a recruiter-review recommendation, not a hire/reject.</p></article><article><span>04</span><h3>Optional LLM node</h3><p>LangChain may create a grounded summary when an API key is configured.</p></article></div><section className="panel agent-run-panel"><div className="panel-heading"><div><h3>Run queue</h3><p>{queued} application{queued === 1 ? '' : 's'} have not yet been processed by the LangChain workflow.</p></div></div><div className="agent-run-list">{screened.map((candidate) => <article key={candidate.id}><Avatar name={candidate.name} size="sm" /><div><strong>{candidate.name}</strong><small>{candidate.agentReview?.recommendation || 'Ready for evidence-first agent review'}</small></div><span className={candidate.agentReview ? 'run-complete' : 'run-ready'}>{candidate.agentReview ? 'Completed' : 'Queued'}</span><button className="secondary-button" onClick={() => onRun(candidate)} disabled={busy === candidate.id}>{busy === candidate.id ? 'Running…' : candidate.agentReview ? 'Run again' : 'Run agent'}</button><button className="icon-button" onClick={() => onOpen(candidate)} aria-label={`Open ${candidate.name}`}><ArrowRight size={16} /></button></article>)}</div></section></div>
}

export default function App() {
  const [view, setView] = useState('overview')
  const [requisition, setRequisition] = useState(() => readStored(STORAGE.requisition, defaultRequisition))
  const [candidates, setCandidates] = useState(() => readStored(STORAGE.candidates, sampleCandidates))
  const [activeCandidate, setActiveCandidate] = useState(null)
  const [showUpload, setShowUpload] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [selected, setSelected] = useState([])
  const [toast, setToast] = useState('')
  const [showCompare, setShowCompare] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [verificationCandidate, setVerificationCandidate] = useState(null)
  const [agentBusy, setAgentBusy] = useState('')
  const [candidateFilter, setCandidateFilter] = useState('all')
  const screened = useMemo(() => screenPool(candidates, requisition), [candidates, requisition])
  const insights = useMemo(() => getPoolInsights(screened, requisition), [screened, requisition])
  useEffect(() => { localStorage.setItem(STORAGE.candidates, JSON.stringify(candidates)) }, [candidates])
  useEffect(() => { localStorage.setItem(STORAGE.requisition, JSON.stringify(requisition)) }, [requisition])
  const selectCandidate = (id) => setSelected((current) => current.includes(id) ? current.filter((x) => x !== id) : current.length < 3 ? [...current, id] : current)
  const applyFilter = (filter) => { setCandidateFilter(filter); setView('candidates') }
  const resetDemo = () => {
    setCandidates(sampleCandidates); setRequisition(defaultRequisition); setSelected([]); setCandidateFilter('all'); setToast('Demo data restored')
    setTimeout(() => setToast(''), 3500)
  }
  const removeCandidate = (id) => {
    const candidate = candidates.find((item) => item.id === id)
    if (!candidate || !window.confirm(`Remove ${candidate.name} from this local applicant pool?`)) return
    setCandidates((current) => current.filter((item) => item.id !== id)); setSelected((current) => current.filter((item) => item !== id)); setActiveCandidate(null); setToast(`${candidate.name} removed from this device`); setTimeout(() => setToast(''), 3500)
  }
  const exportReport = () => {
    const report = {
      generatedAt: new Date().toISOString(), requisition,
      summary: { applicants: screened.length, strongMatches: screened.filter((c) => ['Leading match', 'Strong match'].includes(c.band)).length, claimChecks: screened.reduce((total, c) => total + c.flags.length, 0), poolGaps: insights.filter((i) => i.isGap).map((i) => i.name) },
      candidates: screened.map(({ text, ...candidate }) => candidate),
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = 'verity-screening-report.json'; link.click(); URL.revokeObjectURL(url)
    setToast('Screening report downloaded'); setTimeout(() => setToast(''), 3500)
  }
  const addCandidates = (newCandidates) => {
    setCandidates((current) => [...current, ...newCandidates]); setShowUpload(false); setView('candidates'); setToast(`${newCandidates.length} application${newCandidates.length > 1 ? 's' : ''} screened successfully`); setTimeout(() => setToast(''), 3500)
  }
  const saveVerification = (candidateId, update) => {
    setCandidates((current) => current.map((candidate) => candidate.id === candidateId ? { ...candidate, verification: { ...candidate.verification, ...update } } : candidate))
    setActiveCandidate((current) => current?.id === candidateId ? { ...current, verification: { ...current.verification, ...update } } : current)
  }
  const runAgent = async (candidate) => {
    setAgentBusy(candidate.id)
    try {
      let review
      try {
        const response = await fetch(`${AGENT_API}/api/agent/screen`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidate, requisition }) })
        if (!response.ok) throw new Error('Agent service returned an error')
        review = await response.json()
        review.mode = 'langchain-api'
      } catch { review = localAgentFallback(candidate) }
      setCandidates((current) => current.map((item) => item.id === candidate.id ? { ...item, agentReview: review } : item))
      setActiveCandidate((current) => current?.id === candidate.id ? { ...current, agentReview: review } : current)
      setToast(`${review.mode === 'langchain-api' ? 'LangChain' : 'Local evidence-policy'} review completed for ${candidate.name}`); setTimeout(() => setToast(''), 3500)
    } catch (error) { setToast(error.message); setTimeout(() => setToast(''), 5000) }
    finally { setAgentBusy('') }
  }
  return (
    <div className="app-shell">
      <Sidebar view={view} setView={setView} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      {mobileOpen && <button className="mobile-overlay" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
      <main><Topbar view={view} openUpload={() => setShowUpload(true)} openHelp={() => setShowHelp(true)} onExport={exportReport} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} /><RequisitionHeader requisition={requisition} screened={screened} onEdit={() => setShowEdit(true)} onFilter={applyFilter} />
        {view === 'overview' && <Overview screened={screened} insights={insights} onOpen={setActiveCandidate} onNavigate={setView} onFilter={applyFilter} selected={selected} onSelect={selectCandidate} />}
        {view === 'candidates' && <Candidates screened={screened} onOpen={setActiveCandidate} selected={selected} onSelect={selectCandidate} filterMode={candidateFilter} clearFilter={() => setCandidateFilter('all')} />}
        {view === 'insights' && <Insights insights={insights} screened={screened} />}
        {view === 'agent' && <AgentOperations screened={screened} onOpen={setActiveCandidate} onRun={runAgent} busy={agentBusy} />}
      </main>
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onAdd={addCandidates} candidateCount={candidates.length} />}
      {showEdit && <EditRequisition requisition={requisition} onClose={() => setShowEdit(false)} onSave={(next) => { setRequisition(next); setShowEdit(false); setToast('Requisition saved and applicant pool rescored'); setTimeout(() => setToast(''), 3500) }} />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {activeCandidate && <CandidateDetail candidate={activeCandidate} requisition={requisition} onClose={() => setActiveCandidate(null)} onRemove={() => removeCandidate(activeCandidate.id)} onVerify={() => setVerificationCandidate(activeCandidate)} onRunAgent={() => runAgent(activeCandidate)} />}
      {verificationCandidate && <VerificationModal candidate={verificationCandidate} requisition={requisition} onClose={() => setVerificationCandidate(null)} onSave={(update) => saveVerification(verificationCandidate.id, update)} />}
      {showCompare && <CompareModal candidates={selected.map((id) => screened.find((c) => c.id === id)).filter(Boolean)} requisition={requisition} onClose={() => setShowCompare(false)} onOpen={(candidate) => { setShowCompare(false); setActiveCandidate(candidate) }} />}
      <CompareTray selected={selected} screened={screened} onClear={() => setSelected([])} onOpen={setActiveCandidate} onCompare={() => setShowCompare(true)} />
      {toast && <div className="toast"><CheckCircle2 size={18} />{toast}</div>}
      <button className="reset-demo" onClick={resetDemo}><RotateCcw size={14} /> Restore demo data</button>
    </div>
  )
}

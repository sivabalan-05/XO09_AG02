import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle, ArrowLeft, ArrowRight, BarChart3, Check, CheckCircle2, ChevronDown,
  CircleHelp, CloudUpload, FileText, Filter, LayoutDashboard, Menu, Pencil, Plus,
  Search, ShieldCheck, Sparkles, Target, Users, X, Zap, Download, RotateCcw, Trash2,
  Bot, GitBranch, Link2, ExternalLink, ShieldAlert, Workflow,
} from 'lucide-react'
import { defaultRequisition, sampleCandidates } from './data'
import { getPoolInsights, levelLabels, screenPool } from './screening'
import { analyzeRequisition } from './requisitionAnalysis'
import { downloadScreeningWorkbook } from './reportExport'
import { analyzeExperienceText, candidateExperienceSources, compareSalary, experienceStatusLabel } from './candidateFacts'
import { verifyGitHubProfile, verifyLinkedInEvidence, extractGithubUrl, extractLinkedInUrl, searchGitHubProfiles } from '../agent/verifiers.js'
import { createStableCriterionId } from './requirementSuggestions.js'

const views = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'candidates', label: 'Candidates', icon: Users },
  { id: 'insights', label: 'Pool insights', icon: BarChart3 },
  { id: 'agent', label: 'Agent operations', icon: Bot },
]

function Avatar({ name, size = 'md' }) {
  const colors = ['moss', 'clay', 'navy', 'plum', 'ochre']
  const index = name.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0) % colors.length
  return <span className={`avatar ${colors[index]} ${size}`}>{name.split(' ').filter(Boolean).map((p) => p[0]).join('').slice(0, 2)}</span>
}

function LevelPill({ level, compact = false }) {
  return <span className={`level-pill ${level} ${compact ? 'compact' : ''}`}><span />{levelLabels[level]}</span>
}

const STORAGE = { candidates: 'verity:candidates:v2', requisition: 'verity:requisition:v2' }
const AGENT_API = import.meta.env.VITE_AGENT_API_URL || ''
const LINKEDIN_OAUTH_API = import.meta.env.VITE_LINKEDIN_OAUTH_API_URL || 'http://127.0.0.1:8787'
const REQUIREMENT_API = AGENT_API || LINKEDIN_OAUTH_API
const statusLabels = { active: 'Active', paused: 'Paused', closed: 'Closed' }
function readStored(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback } catch { return fallback }
}

function formatRequisitionDate(value) {
  if (!value) return '08 SEP 2026'
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return String(value).toUpperCase()
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed).toUpperCase()
}

function ScrollProgress() {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const available = document.documentElement.scrollHeight - window.innerHeight
        setProgress(available > 0 ? Math.min(1, window.scrollY / available) : 0)
      })
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [])
  return <div className="scroll-progress" aria-hidden="true"><i style={{ transform: `scaleX(${progress})` }} /></div>
}

function useScrollReveal(trigger) {
  useEffect(() => {
    const targets = [...document.querySelectorAll('.req-title-row, .req-meta, .page-content > .section-heading, .page-content > .metric-grid, .page-content > .gap-banner, .page-content > .panel, .page-content > .tradeoff-section, .page-content > .agent-architecture, .page-content > .method-note')]
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || !('IntersectionObserver' in window)) {
      targets.forEach((target) => target.classList.add('reveal-visible'))
      return undefined
    }
    targets.forEach((target, index) => {
      target.classList.add('reveal-on-scroll')
      target.style.setProperty('--reveal-delay', `${Math.min(index % 3, 2) * 55}ms`)
    })
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('reveal-visible')
        observer.unobserve(entry.target)
      })
    }, { threshold: 0.08, rootMargin: '0px 0px -5% 0px' })
    targets.forEach((target) => observer.observe(target))
    return () => observer.disconnect()
  }, [trigger])
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

function Topbar({ view, requisitionId, openUpload, openHelp, onExport, mobileOpen, setMobileOpen }) {
  return (
    <header className="topbar">
      <button className="icon-button mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileOpen} aria-controls="workspace-navigation"><Menu size={20} /></button>
      <div className="crumb"><span>Requisitions</span><span>/</span><strong>{view === 'overview' ? requisitionId : views.find((v) => v.id === view)?.label}</strong></div>
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
    <aside id="workspace-navigation" className={`sidebar ${mobileOpen ? 'open' : ''}`}>
      <div className="brand"><span className="brand-mark"><ShieldCheck size={20} strokeWidth={2.5} /></span><span><strong>verity</strong><small>Evidence intelligence</small></span></div>
      <nav>
        <p className="nav-label">Workspace</p>
        {views.map(({ id, label, icon: Icon }) => (
          <button key={id} className={view === id ? 'active' : ''} aria-current={view === id ? 'page' : undefined} onClick={() => { setView(id); setMobileOpen(false) }}>
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

function RequisitionHeader({ requisition, screened, onEdit, onFilter, activeFilter }) {
  const strong = screened.filter((c) => ['Leading match', 'Strong match'].includes(c.band)).length
  const status = requisition.status || 'active'
  return (
    <section className="req-header">
      <div className="eyebrow-row"><span className={`status-dot ${status}`}>{statusLabels[status] || status}</span><span>{requisition.id || defaultRequisition.id}</span><span>Created {formatRequisitionDate(requisition.createdAt)}</span></div>
      <div className="req-title-row">
        <div><h1>{requisition.title}</h1><p>{requisition.team}</p></div>
        <button className="secondary-button" onClick={onEdit}><Pencil size={16} /> Edit requisition</button>
      </div>
      <div className="req-meta">
        <button className={activeFilter === 'all' ? 'active' : ''} aria-pressed={activeFilter === 'all'} onClick={() => onFilter('all')}><Users size={16} /><strong>{screened.length}</strong> applicants</button>
        <button className={activeFilter === 'leading' ? 'active' : ''} aria-pressed={activeFilter === 'leading'} onClick={() => onFilter('leading')}><Target size={16} /><strong>{strong}</strong> strong matches</button>
        <button className={activeFilter === 'flagged' ? 'active' : ''} aria-pressed={activeFilter === 'flagged'} onClick={() => onFilter('flagged')}><AlertCircle size={16} /><strong>{screened.reduce((n, c) => n + c.flags.length, 0)}</strong> claim checks</button>
      </div>
    </section>
  )
}

function CandidateRow({ candidate, rank, onOpen, selected, onSelect }) {
  const required = candidate.assessments.filter((assessment) => assessment.criterionType === 'required')
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
      <div><span className="overline">POOL-WIDE GAP</span><h3>{insight.name}</h3><p>No applicant has supported evidence for this required criterion. Consider reframing it as preferred, expanding the role level, or planning to develop it after hire.</p></div>
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
        <button className="metric-block" onClick={() => onNavigate('insights')}><span>Evidence coverage</span><strong>{screened.length ? Math.round(screened.reduce((s, c) => s + c.evidenceCoverage, 0) / screened.length) : 0}%</strong><p>View evidence across all criteria</p></button>
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

function Insights({ insights, screened, requisition, requisitionAnalysis, onOpen }) {
  return (
    <div className="page-content">
      <div className="section-heading"><div><span className="overline">REQUISITION HEALTH</span><h2>What this applicant pool can actually support</h2><p>Coverage is based on concrete evidence—not the frequency of matching keywords.</p></div></div>
      <section className={`no-full-match ${requisitionAnalysis.noFullMatch ? 'active' : ''}`}><ShieldAlert size={22} /><div><span className="overline">SHORTLISTING SAFEGUARD</span><h3>{requisitionAnalysis.noFullMatch ? 'No candidate fully satisfies all required criteria.' : `${requisitionAnalysis.fullMatches.length} candidate${requisitionAnalysis.fullMatches.length === 1 ? '' : 's'} fully satisfy all required criteria.`}</h3><p>{requisitionAnalysis.noFullMatch ? 'The shortlist below shows the closest candidates and the exact weaknesses that still need a recruiter decision.' : 'Trade-offs remain visible for every candidate.'}</p></div></section>
      <section className="panel requisition-analysis"><div className="panel-heading"><div><h3>Requirement conflict & pool feasibility</h3><p>Checks for incompatible or highly restrictive requirements before shortlisting.</p></div></div><div className="conflict-list">{requisitionAnalysis.conflicts.length ? requisitionAnalysis.conflicts.map((conflict) => <article className={conflict.severity} key={conflict.id}><AlertCircle size={17} /><div><strong>{conflict.title}</strong><p>{conflict.detail}</p></div></article>) : <article className="clear"><CheckCircle2 size={17} /><div><strong>No structural conflict detected</strong><p>Current requirements do not trigger a rule-based requisition conflict. Pool coverage is still shown below.</p></div></article>}</div><div className="requirement-coverage">{requisitionAnalysis.requirementCoverage.map((item) => <div key={item.id}><span>{item.type === 'constraint' ? 'CONSTRAINT' : 'REQUIRED'}</span><strong>{item.name}</strong><p><b>{item.met}</b> of {item.total} candidates have supported evidence / meet this constraint</p><i><em style={{ width: `${item.coverage}%` }} /></i></div>)}</div></section>
      <section className="panel tradeoff-shortlist"><div className="panel-heading"><div><h3>Closest-fit shortlist</h3><p>Ordered by required areas met; weaknesses are intentionally not hidden in a composite score.</p></div></div><div className="conflict-shortlist">{requisitionAnalysis.shortlist.map((item) => <button key={item.candidate.id} onClick={() => onOpen(item.candidate)} aria-label={`Open evidence assessment for ${item.candidate.name}`}><Avatar name={item.candidate.name} /><div><h4>{item.candidate.name}</h4><p><CheckCircle2 size={13} /> <strong>Strengths:</strong> {item.strengths.join(', ') || 'No required area strongly evidenced'}</p><p className="shortlist-trade"><AlertCircle size={13} /> <strong>Trade-offs:</strong> {item.tradeoffs.join('; ') || 'No material gap identified'}</p></div><span>{item.matchedRequired}/{requisition.criteria.filter((criterion) => criterion.type === 'required').length}<small>required met</small></span></button>)}</div></section>
      {insights.filter((i) => i.isGap).map((insight) => <PoolGap key={insight.id} insight={insight} poolSize={screened.length} />)}
      <section className="panel coverage-panel">
        <div className="panel-heading"><div><h3>Criterion coverage</h3><p>Applicants with supported or strong evidence for each criterion.</p></div><span className="legend"><i className="supported" /> Supported <i className="partial" /> Partial <i className="missing" /> Missing / claim-only</span></div>
        <div className="coverage-list">{insights.map((insight) => {
          const missing = screened.length - insight.strong - insight.partial
          return (
            <div className="coverage-row" key={insight.id}>
              <div className="coverage-label"><span><strong>{insight.name}</strong><small>{insight.type}{insight.stretch ? ' · stretch requirement' : ''}</small></span><b>{insight.coverage}%</b></div>
              <div className="stacked-bar" aria-label={`${insight.strong} supported, ${insight.partial} partial, ${missing} missing`}><i className="supported" style={{ width: `${screened.length ? insight.strong / screened.length * 100 : 0}%` }} /><i className="partial" style={{ width: `${screened.length ? insight.partial / screened.length * 100 : 0}%` }} /><i className="missing" style={{ width: `${screened.length ? missing / screened.length * 100 : 0}%` }} /></div>
              <div className="coverage-counts"><span>{insight.strong} supported</span><span>{insight.partial} partial</span><span>{missing} missing/claim-only</span></div>
            </div>
          )
        })}</div>
      </section>
      <div className="method-note"><ShieldCheck size={20} /><div><h3>Transparent by design</h3><p>Equivalent terms map to the same criterion (for example, Pub/Sub and Kafka both support event-driven systems). Confidence rises only when a term appears with an action, context, and ideally a measurable outcome. The application is the sole evidence source.</p></div></div>
    </div>
  )
}

const formatYears = (value) => value === null || value === undefined ? 'Not established' : `${value} year${value === 1 ? '' : 's'}`
const formatEvidenceDate = (value) => value ? new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(new Date(value)) : 'Unknown'

function CompensationExperience({ candidate, requisition, onVerify, onShowSource }) {
  const salary = compareSalary(candidate, requisition)
  const experience = candidateExperienceSources(candidate, requisition)
  const resumeEvidence = experience.resume.datedPassages.length ? experience.resume.datedPassages : experience.resume.supportingPassages
  const resumeMeets = experience.minimum > 0 && experience.resume.supportedYears !== null ? experience.resume.supportedYears >= experience.minimum : null
  const linkedinMeets = experience.minimum > 0 && experience.linkedin?.supportedYears !== null && experience.linkedin?.supportedYears !== undefined ? experience.linkedin.supportedYears >= experience.minimum : null
  return <section className="facts-review" aria-label="Salary and experience verification">
    <div className="facts-heading"><div><span className="overline">RECRUITER CHECK</span><h3>Compensation & experience verification</h3><p>Each source stays separate so overlapping dates are never double-counted.</p></div><button className="secondary-button" onClick={onVerify}><ShieldCheck size={15} /> Review external evidence</button></div>
    <article className={`salary-comparison ${salary.status}`}>
      <div className="fact-icon"><Target size={20} /></div><div><span>Job salary ceiling</span><strong>{salary.cap === null ? 'Not set' : `₹${salary.cap} LPA`}</strong></div><div><span>Candidate expectation</span><strong>{salary.expected === null ? 'Not provided' : `₹${salary.expected} LPA`}</strong>{salary.expectationSource && <small>From {salary.expectationSource}</small>}</div><div className="salary-difference"><span>Difference</span><strong>{salary.label}</strong></div>
    </article>
    <div className="experience-title"><div><h4>Experience evidence by source</h4><p>Job minimum: {experience.minimum ? `${experience.minimum}+ years` : 'No minimum configured'}.</p></div><span>GitHub is activity evidence—not employment tenure.</span></div>
    <div className="experience-sources">
      <article className={`experience-source ${experience.resume.status}`}><div className="source-heading"><FileText size={18} /><div><strong>Résumé</strong><span className="source-status">{experienceStatusLabel(experience.resume.status)}</span></div>{resumeMeets !== null && <b className={resumeMeets ? 'meets' : 'misses'}>{resumeMeets ? 'Meets minimum' : 'Below minimum'}</b>}</div><dl><div><dt>Claimed</dt><dd>{formatYears(experience.resume.claimedYears)}</dd></div><div><dt>Supported duration</dt><dd>{formatYears(experience.resume.supportedYears)}</dd></div></dl>{experience.resume.flag && <p className="source-warning"><AlertCircle size={13} /> {experience.resume.flag.assessment}</p>}{resumeEvidence.length ? <div className="fact-evidence">{resumeEvidence.slice(0, 2).map((passage) => <button key={passage.start} onClick={() => onShowSource(passage)}>“{passage.quote}” <span>{passage.section} · line {passage.line} <ArrowRight size={11} /></span></button>)}</div> : <p className="source-empty">No separate dated or responsibility passage supports a duration.</p>}</article>
      <article className="experience-source linkedin"><div className="source-heading"><Link2 size={18} /><div><strong>LinkedIn</strong><span className="source-status">{experience.linkedin ? experienceStatusLabel(experience.linkedin.status) : experience.linkedinConnection?.status === 'identity-connected' ? 'Account connected · identity fields only' : 'Not reviewed'}</span></div>{linkedinMeets !== null && <b className={linkedinMeets ? 'meets' : 'misses'}>{linkedinMeets ? 'Meets minimum' : 'Below minimum'}</b>}</div>{experience.linkedin ? <><dl><div><dt>Claimed</dt><dd>{formatYears(experience.linkedin.claimedYears)}</dd></div><div><dt>Supported duration</dt><dd>{formatYears(experience.linkedin.supportedYears)}</dd></div></dl>{experience.linkedin.supportingPassages?.length ? <div className="fact-evidence static">{experience.linkedin.supportingPassages.slice(0, 2).map((passage, index) => <blockquote key={passage.start ?? index}>“{passage.quote}”</blockquote>)}</div> : <p className="source-empty">The authorized export contains no separate work passage supporting a duration.</p>}</> : experience.linkedinConnection?.status === 'identity-connected' ? <><p className="connected-person">Connected as <strong>{experience.linkedinConnection.oauthProfile?.name || 'LinkedIn member'}</strong></p><p className="source-empty">Standard LinkedIn access did not provide positions or skills. These remain unverified until the app receives approved talent-data scopes.</p></> : <p className="source-empty">Connect the candidate’s LinkedIn account or add a candidate-authorized profile export.</p>}</article>
      <article className="experience-source github"><div className="source-heading"><GitBranch size={18} /><div><strong>GitHub</strong><span className="source-status">{experience.github ? 'Public activity observed' : 'Not reviewed'}</span></div></div>{experience.github ? <><dl><div><dt>Observed span</dt><dd>{formatYears(experience.github.spanYears)}</dd></div><div><dt>Sample</dt><dd>{experience.github.repositoryCount} public repos</dd></div></dl><p className="activity-window">{formatEvidenceDate(experience.github.firstObservedAt)} → {formatEvidenceDate(experience.github.lastObservedAt)}</p><p className="source-empty">Corroborates public technical activity only. It cannot prove professional experience, authorship, or identity.</p></> : <p className="source-empty">Review a candidate-provided profile to inspect public repository activity.</p>}</article>
    </div>
  </section>
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
          <CompensationExperience candidate={candidate} requisition={requisition} onVerify={onVerify} onShowSource={showSource} />
          <section className="claim-checks" aria-label="Contradiction and unsupported claim checks">
            <div className="agent-status-card"><Bot size={18} /><div><strong>LangChain review {candidate.agentReview ? 'completed' : 'available'}</strong><p>{candidate.agentReview?.recommendation || 'Run the agent to create an auditable execution trace and a human-review recommendation.'}</p>{candidate.agentReview?.narrative && <small>{candidate.agentReview.narrative}</small>}{candidate.agentReview?.modelStatus && <small>{candidate.agentReview.modelStatus}</small>}</div><button className="secondary-button" onClick={onRunAgent}>{candidate.agentReview ? 'Run again' : 'Run agent'}</button></div>
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
                {assessment.externalCorroboration?.length > 0 && <div className="external-corroboration"><span><ShieldCheck size={13} /> Cross-checked against external evidence</span>{assessment.externalCorroboration.map((item, i) => <p key={i}>{item.repo ? <a href={item.repoUrl} target="_blank" rel="noreferrer">{item.source} · {item.repo} <ExternalLink size={10} /></a> : item.source} references: {item.terms.join(', ')}</p>)}</div>}
                <div className="confidence-line"><span>Evidence confidence</span><div><i style={{ width: `${assessment.confidence}%` }} /></div><b>{assessment.confidence}%</b></div>
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
    const links = new Set()
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      // PDF text items are often emitted in drawing order, which can separate a
      // bullet's action from its technology/outcome. Rebuild visual rows first.
      const rows = []
      for (const item of content.items) {
        if (!item.str?.trim()) continue
        const x = item.transform?.[4] ?? 0
        const y = item.transform?.[5] ?? rows.length
        let row = rows.find((entry) => Math.abs(entry.y - y) < 2)
        if (!row) { row = { y, parts: [] }; rows.push(row) }
        row.parts.push({ x, text: item.str })
      }
      pages.push(rows.sort((a, b) => b.y - a.y).map((row) => row.parts.sort((a, b) => a.x - b.x).map((part) => part.text).join(' ')).join('\n'))
      // An icon-only hyperlink (e.g. a GitHub/LinkedIn glyph with no visible
      // URL text) carries its target only as a link annotation, not as page
      // text — pull those in too so evidence and profile matching can see them.
      for (const annotation of await page.getAnnotations()) {
        if (annotation.url) links.add(annotation.url)
      }
    }
    return pages.join('\n') + (links.size ? `\n\nLINKS\n${[...links].join('\n')}` : '')
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
  const [salary, setSalary] = useState('')
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef()
  const detectName = (rawText) => {
    const lines = rawText.split('\n').map((line) => line.trim()).filter(Boolean)
    const nameLine = lines.find((line) => /^(?:[A-Z][a-z]{1,30}\s+){1,3}[A-Z][a-z]{1,30}$/.test(line))
    const firstLine = lines.find((line) => line.length > 2)
    return nameLine || firstLine?.slice(0, 45)
  }
  const addFiles = (incoming) => {
    const next = Array.from(incoming)
    const unsupported = next.filter((file) => !/\.(pdf|docx|txt|md)$/i.test(file.name))
    const oversized = next.filter((file) => file.size > 10 * 1024 * 1024)
    const accepted = next.filter((file) => /\.(pdf|docx|txt|md)$/i.test(file.name) && file.size <= 10 * 1024 * 1024)
    if (unsupported.length || oversized.length) {
      const messages = []
      if (unsupported.length) messages.push(`${unsupported.length} unsupported file${unsupported.length === 1 ? '' : 's'} skipped`)
      if (oversized.length) messages.push(`${oversized.length} file${oversized.length === 1 ? '' : 's'} over the 10 MB limit skipped`)
      setError(messages.join('. ') + '.')
    } else setError('')
    setFiles((current) => [...current, ...accepted])
  }
  const submit = async () => {
    if (!files.length && !text.trim()) { setError('Add at least one resume file or paste application text.'); return }
    if (files.length > 1 && text.trim()) { setError('Attach a cover note with one resume at a time so evidence stays associated with the correct applicant.'); return }
    if (text.length > 250000) { setError('Pasted application text exceeds the 250,000-character limit.'); return }
    if (salary !== '' && (!Number.isFinite(Number(salary)) || Number(salary) < 0)) { setError('Salary expectation must be zero or a positive number.'); return }
    setBusy(true); setError('')
    try {
      const candidates = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const fileText = await extractFileText(file)
        if (!fileText.trim()) throw new Error(`${file.name}: no readable text found. Paste the resume text to evaluate a scanned document.`)
        const fallback = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
        candidates.push({ id: `A-${String(candidateCount + candidates.length + 1).padStart(2, '0')}`, name: (files.length === 1 && name.trim()) || detectName(fileText) || fallback, role: 'New applicant', source: 'Upload', expectedSalaryLpa: salary === '' ? undefined : Number(salary), text: fileText + (text.trim() ? `\n\nCOVER NOTE\n${text.trim()}` : '') })
      }
      if (text.trim() && !files.length) candidates.push({ id: `A-${String(candidateCount + candidates.length + 1).padStart(2, '0')}`, name: name.trim() || detectName(text) || 'Pasted applicant', role: 'New applicant', source: 'Pasted text', expectedSalaryLpa: salary === '' ? undefined : Number(salary), text })
      onAdd(candidates)
    } catch (err) { setError(err.message || 'Could not read that application.'); setBusy(false) }
  }
  return (
    <Modal onClose={onClose} label="Add applications">
      <div className="modal-header"><div><span className="overline">NEW SCREENING</span><h2>Add applications</h2><p>Upload resumes or paste application text. Files are analyzed locally in this demo.</p></div><button className="icon-button" onClick={onClose} aria-label="Close add applications"><X size={20} /></button></div>
      <div className="upload-body">
        <button className={`dropzone ${dragging ? 'dragging' : ''}`} onClick={() => fileRef.current.click()} onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}>
          <CloudUpload size={28} /><strong>Drop resumes here, or click to browse</strong><span>PDF, DOCX, TXT, or MD · multiple files · 10 MB each</span><input ref={fileRef} type="file" hidden multiple accept=".pdf,.docx,.txt,.md" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
        </button>
        {files.length > 0 && <div className="file-list">{files.map((file, i) => <div key={`${file.name}-${i}`}><FileText size={16} /><span>{file.name}<small>{Math.max(1, Math.round(file.size / 1024))} KB</small></span><button onClick={() => setFiles(files.filter((_, idx) => idx !== i))} aria-label={`Remove ${file.name}`}><X size={15} /></button></div>)}</div>}
        <div className="or"><span>or paste application text</span></div>
        <label className="field"><span>Candidate name <small>optional</small></span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya Nair" /></label><label className="field"><span>Candidate-provided salary expectation (₹ LPA) <small>optional · used only if requisition has a cap</small></span><input type="number" min="0" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="e.g. 8" /></label>
        <label className="field"><span>{files.length ? 'Cover note for the uploaded resume (optional)' : 'Resume + cover note'}</span><textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={files.length ? 'Paste this applicant’s cover note to cross-check it against their resume…' : 'Paste the complete application here…'} rows={7} /></label>
        {error && <div className="form-error"><AlertCircle size={16} />{error}</div>}
      </div>
      <div className="modal-footer"><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy} onClick={submit}>{busy ? <><span className="spinner" /> Reading applications…</> : <><Zap size={17} /> Screen applications</>}</button></div>
    </Modal>
  )
}

function EditRequisition({ requisition, onClose, onSave }) {
  const [draft, setDraft] = useState(() => structuredClone({ ...defaultRequisition, ...requisition }))
  const [generationMode, setGenerationMode] = useState('enrich')
  const [proposal, setProposal] = useState(null)
  const [selectedTerms, setSelectedTerms] = useState(() => new Set())
  const [includedCriteria, setIncludedCriteria] = useState(() => new Set())
  const [agentState, setAgentState] = useState({ status: 'idle', message: '' })
  const updateCriterion = (index, field, value) => setDraft({ ...draft, criteria: draft.criteria.map((c, i) => i === index ? { ...c, [field]: value } : c) })
  const updateConstraint = (field, value) => setDraft({ ...draft, constraints: { minExperienceYears: 0, maxSalaryLpa: null, seniority: 'junior', ...(draft.constraints || {}), [field]: typeof value === 'number' ? Math.max(0, value) : value } })

  const suggestionKey = (criterionIndex, suggestionIndex) => `${criterionIndex}:${suggestionIndex}`
  const toggleTerm = (key) => setSelectedTerms((current) => {
    const next = new Set(current)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })
  const toggleCriterion = (criterionIndex) => setIncludedCriteria((current) => {
    const next = new Set(current)
    if (next.has(criterionIndex)) next.delete(criterionIndex)
    else next.add(criterionIndex)
    return next
  })
  const generateRequirements = async () => {
    if (!draft.title?.trim() || !draft.description?.trim()) {
      setAgentState({ status: 'error', message: 'Add a role title and job description before generating terminology.' })
      return
    }
    setAgentState({ status: 'loading', message: 'Analyzing the role and building a terminology map…' })
    setProposal(null)
    try {
      const response = await fetch(`${REQUIREMENT_API}/api/agent/requisition-intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: generationMode,
          roleTitle: draft.title,
          jobDescription: draft.description,
          criteria: generationMode === 'enrich' ? draft.criteria.map(({ id, name, type, description, aliases = [] }) => ({ id, name, type, description, aliases })) : [],
        }),
        signal: AbortSignal.timeout(20000),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || body.error || 'The requirement intelligence service is unavailable.')
      const criteria = Array.isArray(body.criteria) ? body.criteria : []
      if (!criteria.length) throw new Error('The agent returned no usable criteria. Add more detail to the job description and try again.')
      const nextSelected = new Set()
      const nextIncluded = new Set()
      criteria.forEach((criterion, criterionIndex) => {
        nextIncluded.add(criterionIndex)
        ;(criterion.suggestions || []).forEach((suggestion, suggestionIndex) => {
          if (suggestion.relationship !== 'related') nextSelected.add(suggestionKey(criterionIndex, suggestionIndex))
        })
      })
      setProposal({ ...body, criteria })
      setSelectedTerms(nextSelected)
      setIncludedCriteria(nextIncluded)
      setAgentState({ status: 'ready', message: `Generated ${criteria.length} reviewable ${criteria.length === 1 ? 'criterion' : 'criteria'}. Nothing affects screening until you apply and save.` })
    } catch (error) {
      const message = error?.name === 'TimeoutError'
        ? 'Requirement generation timed out. Confirm the agent server and model are available, then try again.'
        : error.message || 'Could not generate the requirement map.'
      setAgentState({ status: 'error', message })
    }
  }
  const applyProposal = () => {
    if (!proposal) return
    const selectedFor = (criterion, criterionIndex) => (criterion.suggestions || [])
      .filter((suggestion, suggestionIndex) => selectedTerms.has(suggestionKey(criterionIndex, suggestionIndex)) && suggestion.relationship !== 'related')
      .map((suggestion) => suggestion.term)
    if (proposal.mode === 'replace') {
      const usedIds = []
      const nextCriteria = proposal.criteria
        .map((criterion, criterionIndex) => ({ criterion, criterionIndex }))
        .filter(({ criterionIndex }) => includedCriteria.has(criterionIndex))
        .map(({ criterion, criterionIndex }) => {
          const id = createStableCriterionId(criterion.id || criterion.name, usedIds)
          usedIds.push(id)
          return {
            id,
            name: criterion.name,
            type: criterion.type === 'preferred' ? 'preferred' : 'required',
            description: criterion.description,
            aliases: selectedFor(criterion, criterionIndex),
          }
        })
      if (!nextCriteria.length) {
        setAgentState({ status: 'error', message: 'Select at least one generated criterion before applying the new map.' })
        return
      }
      setDraft({ ...draft, criteria: nextCriteria })
    } else {
      setDraft({
        ...draft,
        criteria: draft.criteria.map((criterion) => {
          const criterionIndex = proposal.criteria.findIndex((item) => item.sourceCriterionId === criterion.id || item.id === criterion.id)
          if (criterionIndex < 0 || !includedCriteria.has(criterionIndex)) return criterion
          const generated = selectedFor(proposal.criteria[criterionIndex], criterionIndex)
          const aliases = [...(criterion.aliases || []), ...generated].filter((term, index, all) => all.findIndex((other) => other.toLocaleLowerCase() === term.toLocaleLowerCase()) === index)
          return { ...criterion, aliases }
        }),
      })
    }
    setProposal(null)
    setAgentState({ status: 'applied', message: 'Approved terminology was added to this draft. Save & rescreen to use it.' })
  }
  return (
    <Modal onClose={onClose} wide label="Edit requisition criteria">
      <div className="modal-header"><div><span className="overline">{draft.id || defaultRequisition.id}</span><h2>Edit requisition criteria</h2><p>Requisition details and assessments refresh immediately after you save.</p></div><button className="icon-button" onClick={onClose} aria-label="Close requisition editor"><X size={20} /></button></div>
      <div className="edit-body">
        <div className="requisition-meta-editor"><label className="field"><span>Requisition ID</span><input required maxLength={24} value={draft.id || ''} onChange={(e) => setDraft({ ...draft, id: e.target.value.toUpperCase() })} /></label><label className="field"><span>Status</span><select value={draft.status || 'active'} onChange={(e) => setDraft({ ...draft, status: e.target.value })}><option value="active">Active</option><option value="paused">Paused</option><option value="closed">Closed</option></select></label><label className="field"><span>Created date</span><input required type="date" value={draft.createdAt || ''} onChange={(e) => setDraft({ ...draft, createdAt: e.target.value })} /></label></div>
        <div className="edit-top"><label className="field"><span>Role title</span><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label><label className="field"><span>Team & location</span><input value={draft.team} onChange={(e) => setDraft({ ...draft, team: e.target.value })} /></label></div>
        <label className="field"><span>Complete job description <small>used by the requirement intelligence agent</small></span><textarea rows={5} value={draft.description || ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Describe the role, responsibilities, required skills and preferred experience…" /></label>
        <section className="requirement-agent" aria-labelledby="requirement-agent-heading">
          <div className="requirement-agent-heading"><div><span className="overline">REQUIREMENT INTELLIGENCE</span><h3 id="requirement-agent-heading"><Sparkles size={18} /> Generate role terminology</h3><p>LangChain proposes a role-specific map. You approve every term before it can affect screening.</p></div><button className="primary-button" type="button" disabled={agentState.status === 'loading'} onClick={generateRequirements}>{agentState.status === 'loading' ? <><span className="spinner" /> Generating…</> : <><Sparkles size={16} /> Generate with AI</>}</button></div>
          <div className="generation-modes" role="radiogroup" aria-label="Requirement generation mode">
            <label className={generationMode === 'enrich' ? 'selected' : ''}><input type="radio" name="generation-mode" value="enrich" checked={generationMode === 'enrich'} onChange={() => { setGenerationMode('enrich'); setProposal(null) }} /><span><strong>Enrich current criteria</strong><small>Keep requirements and fill missing equivalent terminology.</small></span></label>
            <label className={generationMode === 'replace' ? 'selected' : ''}><input type="radio" name="generation-mode" value="replace" checked={generationMode === 'replace'} onChange={() => { setGenerationMode('replace'); setProposal(null) }} /><span><strong>Generate a new map</strong><small>Use for a different role, such as game development.</small></span></label>
          </div>
          {agentState.message && <div className={`agent-message ${agentState.status}`} role={agentState.status === 'error' ? 'alert' : 'status'}>{agentState.status === 'error' ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}<span>{agentState.message}</span></div>}
          {proposal && <div className="requirement-proposal">
            <div className="proposal-header"><div><strong>Review the agent proposal</strong><p>Equivalent and technology terms are selected. Related skills remain unselected because they must not create false matches.</p></div><span>{proposal.criteria.length} criteria</span></div>
            {proposal.warnings?.length > 0 && <div className="proposal-warnings"><ShieldAlert size={17} /><div>{proposal.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div></div>}
            <div className="proposal-criteria">{proposal.criteria.map((criterion, criterionIndex) => <article key={criterion.id || criterion.sourceCriterionId || criterionIndex} className={!includedCriteria.has(criterionIndex) ? 'excluded' : ''}>
              <div className="proposal-criterion-title"><label><input type="checkbox" checked={includedCriteria.has(criterionIndex)} onChange={() => toggleCriterion(criterionIndex)} /><span><small>{criterion.type}</small><strong>{criterion.name}</strong></span></label><p>{criterion.description}</p></div>
              <div className="suggestion-list">{(criterion.suggestions || []).map((suggestion, suggestionIndex) => { const key = suggestionKey(criterionIndex, suggestionIndex); return <label className={`suggestion-chip ${suggestion.relationship}`} key={key} title={suggestion.reason || ''}><input type="checkbox" disabled={!includedCriteria.has(criterionIndex)} checked={selectedTerms.has(key)} onChange={() => toggleTerm(key)} /><span>{suggestion.term}</span><small>{suggestion.relationship}</small></label> })}</div>
            </article>)}</div>
            <div className="proposal-actions"><span>Model: {proposal.model || 'configured requirement model'} · proposal only</span><button type="button" className="secondary-button" onClick={() => { setProposal(null); setAgentState({ status: 'idle', message: '' }) }}>Discard</button><button type="button" className="primary-button" onClick={applyProposal}><Check size={16} /> Apply selected terms</button></div>
          </div>}
        </section>
        <div className="constraint-editor"><span className="overline">RESTRICTIVE REQUIREMENTS</span><p>These fields are checked against the whole pool and against the role level.</p><div><label className="field"><span>Minimum documented experience (years)</span><input type="number" min="0" value={draft.constraints?.minExperienceYears ?? 0} onChange={(e) => updateConstraint('minExperienceYears', Number(e.target.value) || 0)} /></label><label className="field"><span>Maximum salary (₹ LPA) <small>optional</small></span><input type="number" min="0" value={draft.constraints?.maxSalaryLpa ?? ''} onChange={(e) => updateConstraint('maxSalaryLpa', e.target.value === '' ? null : Number(e.target.value))} /></label><label className="field"><span>Target level</span><select value={draft.constraints?.seniority || 'junior'} onChange={(e) => updateConstraint('seniority', e.target.value)}><option value="junior">Junior / entry</option><option value="mid">Mid-level</option><option value="senior">Senior</option></select></label></div></div>
        <p className="edit-helper">These approved terms drive deterministic matching. You can still correct them before saving.</p><div className="criteria-editor">{draft.criteria.map((criterion, index) => <div className="criterion-edit" key={criterion.id}><span className={`criterion-type ${criterion.type}`}>{criterion.type}</span><div><input className="criterion-name-input" aria-label={`Criterion ${index + 1} name`} value={criterion.name} onChange={(e) => updateCriterion(index, 'name', e.target.value)} /><textarea rows={2} aria-label={`${criterion.name} description`} value={criterion.description} onChange={(e) => updateCriterion(index, 'description', e.target.value)} /><label><span>Approved equivalent terms</span><input value={(criterion.aliases || []).join(', ')} onChange={(e) => updateCriterion(index, 'aliases', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} /></label></div></div>)}</div>
      </div>
      <div className="modal-footer"><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" onClick={() => onSave({ ...draft, id: draft.id?.trim() || defaultRequisition.id, status: draft.status || 'active', createdAt: draft.createdAt || defaultRequisition.createdAt })}><Check size={17} /> Save & rescreen</button></div>
    </Modal>
  )
}

function CompareModal({ candidates, requisition, onClose, onOpen }) {
  return <Modal onClose={onClose} wide label="Compare candidate trade-offs"><div className="modal-header"><div><span className="overline">SIDE-BY-SIDE</span><h2>Candidate trade-offs</h2><p>Compare evidence by criterion. No composite score hides the differences.</p></div><button className="icon-button" onClick={onClose} aria-label="Close comparison"><X size={20} /></button></div><div className="compare-matrix" style={{ '--compare-count': candidates.length }}><div className="compare-grid compare-head"><span>Criterion</span>{candidates.map((candidate) => <button key={candidate.id} onClick={() => onOpen(candidate)}><Avatar name={candidate.name} size="sm" /><span><strong>{candidate.name}</strong><small>{candidate.band}</small></span></button>)}</div><div className="compare-grid compare-fact-row"><span className="matrix-criterion"><strong>Salary difference</strong><small>job constraint</small></span>{candidates.map((candidate) => { const salary = compareSalary(candidate, requisition); return <div className="matrix-cell" key={candidate.id}><span className={`fact-pill ${salary.status}`}>{salary.label}</span><p>Job: {salary.cap === null ? 'No ceiling' : `₹${salary.cap} LPA`} · Candidate: {salary.expected === null ? 'Not provided' : `₹${salary.expected} LPA`}</p></div> })}</div><div className="compare-grid compare-fact-row"><span className="matrix-criterion"><strong>Résumé experience</strong><small>internally cross-checked</small></span>{candidates.map((candidate) => { const experience = analyzeExperienceText(candidate.text); return <div className="matrix-cell" key={candidate.id}><span className={`fact-pill ${experience.status}`}>{experienceStatusLabel(experience.status)}</span><p>Claimed: {formatYears(experience.claimedYears)} · Supported: {formatYears(experience.supportedYears)}</p></div> })}</div>{requisition.criteria.map((criterion) => <div className="compare-grid" key={criterion.id}><span className="matrix-criterion"><strong>{criterion.name}</strong><small>{criterion.type}</small></span>{candidates.map((candidate) => { const item = candidate.assessments.find((a) => a.criterionId === criterion.id); return <div className="matrix-cell" key={candidate.id}><LevelPill level={item.level} compact /><p>{item.evidence[0] || 'No supporting passage found.'}</p></div> })}</div>)}</div><div className="modal-footer"><button className="primary-button" onClick={onClose}>Done comparing</button></div></Modal>
}

function CompareTray({ selected, screened, onClear, onOpen, onCompare }) {
  if (!selected.length) return null
  const people = selected.map((id) => screened.find((c) => c.id === id)).filter(Boolean)
  return <div className="compare-tray"><div className="compare-people">{people.map((person) => <button key={person.id} onClick={() => onOpen(person)}><Avatar name={person.name} size="sm" /><span>{person.name.split(' ')[0]}</span></button>)}</div><span>{people.length}/3 selected</span>{people.length > 1 && <button className="tray-primary" onClick={onCompare}>Compare</button>}<button className="secondary-button" onClick={onClear}>Clear</button></div>
}

function HelpModal({ onClose }) {
  return <Modal onClose={onClose} wide label="How Verity scoring works">
    <div className="modal-header"><div><span className="overline">GUIDE</span><h2>How the screening works</h2><p>Every result is grounded in the submitted application, optionally cross-checked against verified external evidence.</p></div><button className="icon-button" onClick={onClose} aria-label="Close guide"><X size={20} /></button></div>
    <div className="help-body">
      <section><span className="help-step">1</span><div><h3>Match equivalent terms</h3><p>Criteria use aliases, so Kafka, Pub/Sub and RabbitMQ can all support distributed-systems experience.</p></div></section>
      <section><span className="help-step">2</span><div><h3>Check evidence quality</h3><p>Action verbs, operating context and measurable outcomes strengthen evidence. A skills list or course alone does not carry the same weight.</p></div></section>
      <section><span className="help-step">3</span><div><h3>Check application consistency</h3><p>Claims are compared with dates, responsibilities and cover-note statements. Flags quote the exact passages reviewed and are not a finding of dishonesty.</p></div></section>
      <section><span className="help-step">4</span><div><h3>Cross-check external evidence</h3><p>A verified GitHub repo or authorized LinkedIn export touching the same skill can nudge that criterion's confidence up by one step, capped below "strong" — never enough to erase a contradiction, always cited to its exact source.</p></div></section>
      <section><span className="help-step">5</span><div><h3>Show trade-offs and pool gaps</h3><p>Ranking stays explainable. Candidate comparison and pool insights show strengths, gaps and requirements no applicant fully meets.</p></div></section>
      <div className="help-note"><ShieldCheck size={18} /><p>Confidence reflects support in the submitted application and any verified external evidence, not the probability that a candidate is truthful. Human review remains the final decision.</p></div>
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
  const [linkedinOAuthStatus, setLinkedinOAuthStatus] = useState(null)
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const request = async (path, body) => {
    const response = await fetch(`${AGENT_API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || 'The verification service is unavailable. Start the app with npm run dev:full.')
    return response.json()
  }
  const checkGitHub = async (urlOverride) => {
    const url = urlOverride ?? githubUrl
    setBusy('github'); setError('')
    try { const result = AGENT_API ? await request('/api/verify/github', { profileUrl: url, requisition }) : await verifyGitHubProfile(url, requisition); setGithubResult(result); onSave({ github: result }) }
    catch (err) { setError(err.message) } finally { setBusy('') }
  }
  const checkLinkedIn = async (urlOverride) => {
    const url = urlOverride ?? linkedinUrl
    setBusy('linkedin'); setError('')
    try { const result = AGENT_API ? await request('/api/verify/linkedin', { url, authorizedText: linkedinText, requisition }) : verifyLinkedInEvidence({ url, authorizedText: linkedinText, requisition }); setLinkedinResult(result); onSave({ linkedin: result }) }
    catch (err) { setError(err.message) } finally { setBusy('') }
  }
  const connectLinkedIn = async () => {
    setBusy('linkedin-oauth'); setError('')
    const popup = window.open('', 'verity-linkedin-oauth', 'popup=yes,width=560,height=720')
    if (!popup) { setBusy(''); setError('Allow pop-ups for this site, then try connecting LinkedIn again.'); return }
    popup.document.write('<p style="font:16px system-ui;padding:24px">Preparing the secure LinkedIn connection…</p>')
    const popupMonitor = window.setInterval(() => { if (popup.closed) { window.clearInterval(popupMonitor); setBusy('') } }, 500)
    try {
      const response = await fetch(`${LINKEDIN_OAUTH_API}/api/auth/linkedin/start?candidateId=${encodeURIComponent(candidate.id)}`, { signal: AbortSignal.timeout(8000) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body.authorizationUrl) throw new Error(body.error || 'LinkedIn OAuth is not configured on the agent server.')
      popup.location.assign(body.authorizationUrl)
    } catch (err) {
      window.clearInterval(popupMonitor)
      popup.close()
      setBusy('')
      setError(err.message || 'Could not start the LinkedIn connection.')
    }
  }
  const chooseGithubMatch = (profile) => { setSearchResults(null); setGithubUrl(profile.url); checkGitHub(profile.url) }
  // A resume-provided link is used automatically — nothing is being inferred,
  // the candidate wrote it themselves. With no link, fall back to searching by
  // the recruiter-entered name so a human confirms the match before it's used.
  const resumeGithubUrl = extractGithubUrl(candidate.text)
  const resumeLinkedinUrl = extractLinkedInUrl(candidate.text)
  useEffect(() => {
    if (candidate.verification?.github) return
    if (resumeGithubUrl) { Promise.resolve().then(() => { setGithubUrl(resumeGithubUrl); checkGitHub(resumeGithubUrl) }); return }
    Promise.resolve().then(() => setSearching(true))
    ;(AGENT_API ? request('/api/verify/github/search', { name: candidate.name }).then((r) => r.results) : searchGitHubProfiles(candidate.name))
      .then(setSearchResults)
      .catch((err) => setSearchError(err.message))
      .finally(() => setSearching(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.id])
  useEffect(() => {
    if (candidate.verification?.linkedin) return
    if (resumeLinkedinUrl) Promise.resolve().then(() => { setLinkedinUrl(resumeLinkedinUrl); checkLinkedIn(resumeLinkedinUrl) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.id])
  useEffect(() => {
    const controller = new AbortController()
    fetch(`${LINKEDIN_OAUTH_API}/api/auth/linkedin/status`, { signal: controller.signal })
      .then(async (response) => response.ok ? response.json() : Promise.reject(new Error('LinkedIn OAuth status unavailable.')))
      .then(setLinkedinOAuthStatus)
      .catch((err) => { if (err.name !== 'AbortError') setLinkedinOAuthStatus({ configured: false, message: 'Start the agent backend with npm run dev:full, then configure LinkedIn OAuth.' }) })
    return () => controller.abort()
  }, [])
  useEffect(() => {
    const oauthOrigin = new URL(LINKEDIN_OAUTH_API, window.location.origin).origin
    const receiveLinkedIn = (event) => {
      if (event.origin !== oauthOrigin || event.data?.type !== 'verity:linkedin-oauth') return
      if (event.data.candidateId && event.data.candidateId !== candidate.id) return
      setBusy('')
      if (!event.data.ok || !event.data.verification) { setError(event.data.error || 'LinkedIn authorization failed.'); return }
      const result = { ...event.data.verification, url: linkedinUrl || resumeLinkedinUrl || '' }
      setLinkedinResult(result)
      onSave({ linkedin: result })
    }
    window.addEventListener('message', receiveLinkedIn)
    return () => window.removeEventListener('message', receiveLinkedIn)
  }, [candidate.id, linkedinUrl, onSave, resumeLinkedinUrl])
  const renderResult = (result) => result && <div className={`provider-result ${result.status}`}><strong>{result.provider} · {result.status.replaceAll('-', ' ')}</strong><p>{result.message || result.disclaimer}</p>{result.oauthProfile && <p className="connected-person">Connected member: <strong>{result.oauthProfile.name || 'LinkedIn member'}</strong></p>}{result.profile && <p>Profile: <a href={result.profile.url} target="_blank" rel="noreferrer">@{result.profile.handle} <ExternalLink size={12} /></a> · {result.profile.publicRepos} public repos</p>}{result.evidence?.length > 0 && <ul>{result.evidence.slice(0, 4).map((item, index) => <li key={item.url || index}>{typeof item === 'string' ? item : <a href={item.url} target="_blank" rel="noreferrer">{item.name} · {item.language} <ExternalLink size={11} /></a>}</li>)}</ul>}{result.criteriaSignals?.length > 0 && <p><strong>Terminology signals to review:</strong> {[...new Set(result.criteriaSignals.map((signal) => signal.criterion))].join(', ')}. These are not proficiency scores.</p>}{result.disclaimer && result.message !== result.disclaimer && <p><strong>Boundary:</strong> {result.disclaimer}</p>}</div>
  return <Modal onClose={onClose} wide label="External evidence review">
    <div className="modal-header"><div><span className="overline">CONSENT-BASED VERIFICATION</span><h2>External evidence review</h2><p>For {candidate.name}. A matching skill term here is folded into that criterion's confidence as a small, capped, cited cross-check. It never overrides a contradiction and cannot make unsupported evidence “strong” on its own.</p></div><button className="icon-button" onClick={onClose} aria-label="Close verification"><X size={20} /></button></div>
    <div className="verification-body">
      <section className="provider-card">
        <div><GitBranch size={21} /><div><h3>GitHub public evidence</h3><p>Read-only public profile and repository metadata. It cannot prove authorship, skill level or employment.</p></div></div>
        {resumeGithubUrl && githubUrl === resumeGithubUrl && <small className="auto-detected"><Sparkles size={12} /> Link found in the resume — checked automatically.</small>}
        <label className="field"><span>Candidate-provided GitHub profile</span><input value={githubUrl} onChange={(event) => setGithubUrl(event.target.value)} placeholder="https://github.com/username" /></label>
        <button className="secondary-button" disabled={busy === 'github'} onClick={() => checkGitHub()}>{busy === 'github' ? 'Checking…' : 'Review public GitHub'}</button>
        {!githubUrl && (searching ? <p className="search-status">Searching GitHub for “{candidate.name}”…</p> : searchResults && (searchResults.length ? <div className="github-search-results"><span>No link in the resume. Possible matches for “{candidate.name}” — confirm before using one:</span>{searchResults.map((profile) => <div className="github-search-row" key={profile.login}><img src={profile.avatarUrl} alt="" width={24} height={24} /><a href={profile.url} target="_blank" rel="noreferrer">@{profile.login} <ExternalLink size={11} /></a><button className="text-link" onClick={() => chooseGithubMatch(profile)}>Use this profile</button></div>)}</div> : <p className="search-status">No GitHub profiles found for “{candidate.name}”. Enter a profile URL if you have one.</p>))}
        {searchError && <p className="search-status">{searchError}</p>}{renderResult(githubResult)}
      </section>
      <section className="provider-card">
        <div><Link2 size={21} /><div><h3>LinkedIn official connection</h3><p>Candidate OAuth consent connects the account securely. Access tokens stay on the server and are never stored in the browser.</p></div></div>
        <div className={`oauth-connect-panel ${linkedinOAuthStatus?.configured ? 'ready' : ''}`}>
          <div><strong>{linkedinOAuthStatus?.configured ? 'OAuth ready' : 'Setup required'}</strong><p>{linkedinOAuthStatus?.message || 'Checking the LinkedIn agent service…'}</p></div>
          <button className="secondary-button" disabled={!linkedinOAuthStatus?.configured || busy === 'linkedin-oauth'} onClick={connectLinkedIn}>{busy === 'linkedin-oauth' ? 'Connecting…' : linkedinResult?.status === 'identity-connected' ? 'Reconnect LinkedIn' : 'Connect LinkedIn'}</button>
        </div>
        {resumeLinkedinUrl && linkedinUrl === resumeLinkedinUrl && <small className="auto-detected"><Sparkles size={12} /> Link found in the resume. A link alone is not treated as verified evidence.</small>}
        <label className="field"><span>Candidate-provided profile link <small>optional</small></span><span className="linked-field"><input value={linkedinUrl} onChange={(event) => setLinkedinUrl(event.target.value)} placeholder="https://www.linkedin.com/in/..." />{linkedinUrl && <a className="secondary-button" href={linkedinUrl} target="_blank" rel="noreferrer">Open <ExternalLink size={12} /></a>}</span></label>
        {renderResult(linkedinResult)}
        <div className="manual-evidence-divider"><span>Authorized evidence fallback</span></div>
        <label className="field"><span>Candidate-authorized profile text</span><textarea rows={5} value={linkedinText} onChange={(event) => setLinkedinText(event.target.value)} placeholder="Paste experience or project text the candidate has authorized you to use…" /></label>
        <button className="secondary-button" disabled={busy === 'linkedin' || !linkedinText.trim()} onClick={() => checkLinkedIn()}>{busy === 'linkedin' ? 'Comparing…' : 'Compare authorized text'}</button>
        <p className="provider-boundary"><ShieldAlert size={14} /> Standard LinkedIn OpenID access does not expose employment history or skills. Those checks remain visibly unavailable unless LinkedIn approves additional products and scopes.</p>
      </section>
      {error && <div className="form-error"><AlertCircle size={16} />{error}</div>}
      <div className="consent-note"><ShieldAlert size={18} /><p>Recruiter safeguard: never use protected characteristics, inferred identity, network connections, or private data in the fit assessment. These providers are evidence sources for human review—not automatic background checks.</p></div>
    </div>
    <div className="modal-footer"><button className="primary-button" onClick={onClose}>Done</button></div>
  </Modal>
}

function AgentOperations({ screened, onOpen, onRun, busy }) {
  const completed = screened.filter((candidate) => candidate.agentReview).length
  const queued = screened.filter((candidate) => !candidate.agentReview).length
  return <div className="page-content"><div className="section-heading"><div><span className="overline">LANGCHAIN ORCHESTRATION</span><h2>Autonomous, reviewable screening runs</h2><p>Every run follows a fixed evidence-first workflow; humans retain the hiring decision.</p></div><span className="audit-badge"><Workflow size={16} /> {completed} auditable runs</span></div><div className="agent-architecture"><article><span>01</span><h3>Intake node</h3><p>Retains resume and cover-note source text; no hidden enrichment.</p></article><article><span>02</span><h3>Evidence node</h3><p>Maps aliases, scores support, and cites contradictions.</p></article><article><span>03</span><h3>Policy node</h3><p>Produces a recruiter-review recommendation, not a hire/reject.</p></article><article><span>04</span><h3>Optional LLM node</h3><p>LangChain may create a grounded summary when an API key is configured.</p></article></div><section className="panel agent-run-panel"><div className="panel-heading"><div><h3>Run queue</h3><p>{queued} application{queued === 1 ? '' : 's'} have not yet been processed by the LangChain workflow.</p></div></div><div className="agent-run-list">{screened.map((candidate) => <article key={candidate.id}><Avatar name={candidate.name} size="sm" /><div><strong>{candidate.name}</strong><small>{candidate.agentReview?.recommendation || 'Ready for evidence-first agent review'}</small></div><span className={candidate.agentReview ? 'run-complete' : 'run-ready'}>{candidate.agentReview ? 'Completed' : 'Queued'}</span><button className="secondary-button" onClick={() => onRun(candidate)} disabled={busy === candidate.id}>{busy === candidate.id ? 'Running…' : candidate.agentReview ? 'Run again' : 'Run agent'}</button><button className="icon-button" onClick={() => onOpen(candidate)} aria-label={`Open ${candidate.name}`}><ArrowRight size={16} /></button></article>)}</div></section></div>
}

export default function App() {
  const [view, setView] = useState('overview')
  const [requisition, setRequisition] = useState(() => ({ ...defaultRequisition, ...readStored(STORAGE.requisition, defaultRequisition) }))
  const [candidates, setCandidates] = useState(() => readStored(STORAGE.candidates, sampleCandidates))
  const [activeCandidateId, setActiveCandidateId] = useState(null)
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
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [view])
  const screened = useMemo(() => screenPool(candidates, requisition), [candidates, requisition])
  // Derived, not stored: always the current screened entry for this id, so a
  // live verification or agent-run update is reflected immediately instead of
  // needing a hand-patched snapshot that can drift out of sync (assessments,
  // confidence, band recompute here automatically along with .verification).
  const activeCandidate = activeCandidateId ? screened.find((c) => c.id === activeCandidateId) || null : null
  const insights = useMemo(() => getPoolInsights(screened, requisition), [screened, requisition])
  const requisitionAnalysis = useMemo(() => analyzeRequisition(screened, requisition), [screened, requisition])
  useScrollReveal(`${view}:${screened.length}:${requisition.title}`)
  useEffect(() => { try { localStorage.setItem(STORAGE.candidates, JSON.stringify(candidates)) } catch { /* Keep the current in-memory session usable when storage is unavailable. */ } }, [candidates])
  useEffect(() => { try { localStorage.setItem(STORAGE.requisition, JSON.stringify(requisition)) } catch { /* Keep the current in-memory session usable when storage is unavailable. */ } }, [requisition])
  const selectCandidate = (id) => setSelected((current) => current.includes(id) ? current.filter((x) => x !== id) : current.length < 3 ? [...current, id] : current)
  const applyFilter = (filter) => { setCandidateFilter(filter); setView('candidates') }
  const resetDemo = () => {
    setCandidates(sampleCandidates); setRequisition(defaultRequisition); setSelected([]); setCandidateFilter('all'); setToast('Demo data restored')
    setTimeout(() => setToast(''), 3500)
  }
  const removeCandidate = (id) => {
    const candidate = candidates.find((item) => item.id === id)
    if (!candidate || !window.confirm(`Remove ${candidate.name} from this local applicant pool?`)) return
    setCandidates((current) => current.filter((item) => item.id !== id)); setSelected((current) => current.filter((item) => item !== id)); setActiveCandidateId(null); setToast(`${candidate.name} removed from this device`); setTimeout(() => setToast(''), 3500)
  }
  const exportReport = async () => {
    try {
      setToast('Preparing Excel screening workbook…')
      await downloadScreeningWorkbook({ screened, requisition, insights, requisitionAnalysis })
      setToast('Excel screening workbook downloaded')
    } catch (error) { setToast(`Could not export report: ${error.message}`) }
    setTimeout(() => setToast(''), 3500)
  }
  const addCandidates = (newCandidates) => {
    setCandidates((current) => [...current, ...newCandidates]); setShowUpload(false); setView('candidates'); setToast(`${newCandidates.length} application${newCandidates.length > 1 ? 's' : ''} screened successfully`); setTimeout(() => setToast(''), 3500)
  }
  const saveVerification = (candidateId, update) => {
    setCandidates((current) => current.map((candidate) => candidate.id === candidateId ? { ...candidate, verification: { ...candidate.verification, ...update } } : candidate))
  }
  const saveRequisition = (next) => {
    const assessmentInputsChanged = JSON.stringify({ title: requisition.title, description: requisition.description, criteria: requisition.criteria }) !== JSON.stringify({ title: next.title, description: next.description, criteria: next.criteria })
    setRequisition(next)
    if (assessmentInputsChanged) {
      setCandidates((current) => current.map((candidate) => ({
        ...candidate,
        agentReview: undefined,
        verification: candidate.verification ? {
          ...candidate.verification,
          github: candidate.verification.github ? { ...candidate.verification.github, criteriaSignals: [] } : candidate.verification.github,
          linkedin: candidate.verification.linkedin ? { ...candidate.verification.linkedin, criteriaSignals: [] } : candidate.verification.linkedin,
        } : candidate.verification,
      })))
    }
    setShowEdit(false)
    setToast(assessmentInputsChanged ? 'Requisition saved, stale evidence mappings cleared, and pool rescored' : 'Requisition details saved')
    setTimeout(() => setToast(''), 3500)
  }
  const runAgent = async (candidate) => {
    setAgentBusy(candidate.id)
    try {
      let review
      try {
        if (!AGENT_API) throw new Error('Use browser agent')
        const response = await fetch(`${AGENT_API}/api/agent/screen`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidate, requisition }), signal: AbortSignal.timeout(8000) })
        if (!response.ok) throw new Error('Agent service returned an error')
        review = await response.json()
        review.mode = 'langchain-api'
      } catch {
        const { runBrowserLangChain } = await import('./browserAgent')
        review = await runBrowserLangChain(candidate)
      }
      setCandidates((current) => current.map((item) => item.id === candidate.id ? { ...item, agentReview: review } : item))
      setToast(`LangChain review completed for ${candidate.name}`); setTimeout(() => setToast(''), 3500)
    } catch (error) { setToast(error.message); setTimeout(() => setToast(''), 5000) }
    finally { setAgentBusy('') }
  }
  return (
    <div className="app-shell">
      <ScrollProgress />
      <Sidebar view={view} setView={setView} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      {mobileOpen && <button className="mobile-overlay" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
      <main className="main-content"><Topbar view={view} requisitionId={requisition.id || defaultRequisition.id} openUpload={() => setShowUpload(true)} openHelp={() => setShowHelp(true)} onExport={exportReport} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} /><RequisitionHeader requisition={requisition} screened={screened} onEdit={() => setShowEdit(true)} onFilter={applyFilter} activeFilter={view === 'candidates' ? candidateFilter : 'all'} />
        {view === 'overview' && <Overview screened={screened} insights={insights} onOpen={(candidate) => setActiveCandidateId(candidate.id)} onNavigate={setView} onFilter={applyFilter} selected={selected} onSelect={selectCandidate} />}
        {view === 'candidates' && <Candidates screened={screened} onOpen={(candidate) => setActiveCandidateId(candidate.id)} selected={selected} onSelect={selectCandidate} filterMode={candidateFilter} clearFilter={() => setCandidateFilter('all')} />}
        {view === 'insights' && <Insights insights={insights} screened={screened} requisition={requisition} requisitionAnalysis={requisitionAnalysis} onOpen={(candidate) => setActiveCandidateId(candidate.id)} />}
        {view === 'agent' && <AgentOperations screened={screened} onOpen={(candidate) => setActiveCandidateId(candidate.id)} onRun={runAgent} busy={agentBusy} />}
      </main>
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onAdd={addCandidates} candidateCount={candidates.length} />}
      {showEdit && <EditRequisition requisition={requisition} onClose={() => setShowEdit(false)} onSave={saveRequisition} />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {activeCandidate && <CandidateDetail candidate={activeCandidate} requisition={requisition} onClose={() => setActiveCandidateId(null)} onRemove={() => removeCandidate(activeCandidate.id)} onVerify={() => setVerificationCandidate(activeCandidate)} onRunAgent={() => runAgent(activeCandidate)} />}
      {verificationCandidate && <VerificationModal candidate={verificationCandidate} requisition={requisition} onClose={() => setVerificationCandidate(null)} onSave={(update) => saveVerification(verificationCandidate.id, update)} />}
      {showCompare && <CompareModal candidates={selected.map((id) => screened.find((c) => c.id === id)).filter(Boolean)} requisition={requisition} onClose={() => setShowCompare(false)} onOpen={(candidate) => { setShowCompare(false); setActiveCandidateId(candidate.id) }} />}
      <CompareTray selected={selected} screened={screened} onClear={() => setSelected([])} onOpen={(candidate) => setActiveCandidateId(candidate.id)} onCompare={() => setShowCompare(true)} />
      {toast && <div className="toast"><CheckCircle2 size={18} />{toast}</div>}
      <button className="reset-demo" onClick={resetDemo}><RotateCcw size={14} /> Restore demo data</button>
    </div>
  )
}

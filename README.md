# Verity — Evidence-first Hiring

Verity screens job applicants against a requisition by reading what their application actually *proves*, not by counting keywords. It reads claims and evidence from separate places, cites every judgement back to an exact line of the source text, flags contradictions between what a candidate says in different places, and — when a recruiter confirms a public GitHub profile or provides an authorized LinkedIn export — cross-checks that evidence into the score too, always capped and always cited.

It does not make a hiring decision. It produces a traceable, evidence-backed recommendation for a human recruiter to review.

This document explains every part of the project: what each file does, the exact scoring math, every API route, every Excel sheet, and how a resume travels from upload to shortlist.

---

## Table of contents

1. [Why](#why)
2. [Quick start](#quick-start)
3. [Architecture](#architecture)
4. [Data model](#data-model)
5. [The screening pipeline](#the-screening-pipeline)
6. [Contradiction detection](#contradiction-detection)
7. [Requisition analysis](#requisition-analysis)
8. [External verification (GitHub / LinkedIn) & the confidence cross-check](#external-verification)
9. [Resume upload & text extraction](#resume-upload--text-extraction)
10. [LangChain agent](#langchain-agent)
11. [Excel export](#excel-export)
12. [Server API](#server-api)
13. [UI component reference](#ui-component-reference)
14. [File-by-file guide](#file-by-file-guide)
15. [Testing](#testing)
16. [Tooling & configuration](#tooling--configuration)
17. [Safeguards & design principles](#safeguards--design-principles)
18. [Known limitations](#known-limitations)

---

## Why

A keyword matcher counts mentions. A mention is something a candidate wrote about themselves — it isn't proof. Verity separates the two:

| | Read from | Measures |
|---|---|---|
| **Claim** | summary, skills list, cover note | How the candidate rates themselves |
| **Evidence** | the entire application | What the document actually demonstrates |

Every criterion assessment quotes the exact resume passage behind it. Every contradiction flag cites both the claim and the conflicting passage. Nothing is asserted without a receipt.

## Quick start

```bash
npm install
npm run dev
```

Open the printed Vite URL (default `http://localhost:5173`). The app is fully functional client-only: resume parsing, scoring, contradiction detection, GitHub verification, and Excel export all run in the browser. State (candidates + requisition) persists to `localStorage` per browser/device — there is no database.

To also run the optional Express agent API (needed for the server-side LangChain path and for the GitHub/LinkedIn verification endpoints to go through a backend instead of directly from the browser):

```bash
npm run dev:full
```

For the optional LLM-grounded summary node, copy `.env.example` to `.env`:

```
OPENAI_API_KEY=       # enables the LangChain grounded-summary node; never exposed to the browser
OPENAI_MODEL=gpt-4.1-mini
AGENT_PORT=8787
```

Without a key, every deterministic stage still runs and the app is fully usable — the LLM node is pure enhancement, never a dependency.

## Architecture

```
┌─────────────────────────────┐        ┌──────────────────────────┐
│  Browser (React + Vite)      │        │  Express agent API        │
│                              │  HTTP  │  (optional, npm run       │
│  Upload → extract → screen  │◄──────►│  dev:agent / dev:full)     │
│  → display → export         │        │                            │
│                              │        │  /api/agent/screen         │
│  Falls back to a client-side│        │  /api/verify/github        │
│  LangChain workflow and      │        │  /api/verify/github/search │
│  direct GitHub/LinkedIn      │        │  /api/verify/linkedin       │
│  calls when the API isn't    │        │                            │
│  running.                    │        │  → LangChain RunnableSeq   │
└─────────────────────────────┘        │  → GitHub REST API          │
              │                         └──────────────────────────┘
              │ localStorage
              ▼
   verity:candidates:v2
   verity:requisition:v2
```

The browser never *requires* the server. `App.jsx` always tries the API first (when `VITE_AGENT_API_URL` is set) and transparently falls back to doing the same work client-side (`src/browserAgent.js`, or calling `agent/verifiers.js` functions directly) if the API call fails or isn't configured. Resume text never leaves the device unless the recruiter explicitly runs GitHub/LinkedIn verification (which only talks to GitHub's public API or compares candidate-authorized text — see [Safeguards](#safeguards--design-principles)).

## Data model

**Requisition** (`src/data.js` → `defaultRequisition`, editable in the UI via `EditRequisition`):

```js
{
  title, team, description,
  constraints: { minExperienceYears, maxSalaryLpa, seniority },
  criteria: [
    { id, name, type: 'required' | 'preferred', description, aliases: [...], stretch?: true }
  ],
}
```

The seeded requisition ("Junior Platform Engineer") has 7 criteria: 5 required (one, `multiregion`, marked `stretch: true` — a deliberately restrictive requirement) and 2 preferred (`iac`, `collaboration`).

**Candidate** (as stored; `assessments`/`flags`/etc. are computed, not stored):

```js
{
  id, name, role, source, text,               // raw application text
  expectedSalaryLpa?,                          // optional, for the salary-cap constraint
  agentReview?: { recommendation, trace, narrative, modelStatus, mode },
  verification?: { github?: {...}, linkedin?: {...} },
}
```

`screenCandidate(candidate, requisition)` (in `src/screening.js`) turns a raw candidate into a **scored candidate** by adding: `assessments` (per-criterion), `flags` (contradictions), `confidence`, `band`, `requiredStrong`, `requiredTotal`, `evidenceCoverage`, `unsupportedCount`, `strength`/`tradeoff` text, and more. The UI only ever renders scored candidates (the `screened` array in `App.jsx`, recomputed with `useMemo` whenever `candidates` or `requisition` changes).

## The screening pipeline

All of this lives in **`src/screening.js`**.

**1. Split the resume into evidence lines** — `splitEvidence(text)` splits on newlines and sentence boundaries, strips bullet markers, and drops anything under 15 characters (too short to be meaningful evidence).

**2. Match each criterion's aliases** — `hitsFor(line, aliases)` uses `containsTerm` (from `src/contradictions.js`) to do whole-word, plural-tolerant matching (e.g. "systems" also matches an alias ending in `system`).

**3. Score each matching line** (`assessCriterion`) against five regexes:

| Signal | What it looks for | Effect |
|---|---|---|
| `claimWords` | expert, world-class, proficient, extensive, specialist… | self-rating language |
| `evidenceWords` | built, deployed, operated, led, resolved, migrated… | an action verb |
| `quantified` | a number with a unit — %, ms, users, requests, regions… | a measurable outcome |
| `productionWords` | production, customer, enterprise, on-call, incident, sla, uptime… | a real operating context |
| `caveatWords` | not, coursework, toy, guided, shadowed, academic, personal project… | weakens the line |

Score starts at 1; `+2` for an action verb, `+2` for a quantified outcome, `+1` for production context, `−2` for a caveat, `−1` if it's a bare self-rating with no action or metric. The **best-scoring line** for that criterion decides the level:

- **strong** — best score ≥ 5 *and* at least one non-caveated action line also has production context. Confidence: `78 + 4×(production examples) + 3×(metric examples)`, capped at 96.
- **supported** — best score ≥ 3 with at least one action example. Confidence: `66 + 4×(action examples) + 3×(metric examples)`, capped at 88.
- **claim-only** — a bare self-rating with no action/metric anywhere. Confidence 38.
- **emerging** — anything else that matched (terminology present, but indirect/academic). Confidence 58.
- **not-addressed** — no line matched any alias at all. Confidence 0.

The **`multiregion`** criterion has a special rule on top: it also requires `meetsTenKRequestScale` (a ≥10,000 requests/sec figure, parsed from `\d{1,3}(?:,\d{3})+|\d+k` patterns) *and* an ownership verb (`led|owned|architected`) *and* a production-context line — otherwise the level is downgraded to `partial`/`claim-only`/`emerging` regardless of the base score, because "I helped with a multi-region migration" and "I led a multi-region migration serving 10k rps" are not the same claim.

**4. Apply contradiction flags** — any criterion with a relevant flag (see next section) has its confidence cut by 15 points (further capped by the flag's own `confidenceCap`, 35 for a contradiction or 50 for an unsupported claim), and a `strong` level is downgraded to `supported` so a flagged claim can never read as the top tier.

**5. Apply the external-corroboration cross-check** — see [External verification](#external-verification) below. This runs *after* the contradiction step, so it can never paper over a real contradiction.

**6. Aggregate to a candidate score**:
- `requiredStrong` / `requiredPartial` — counts of required criteria at `strong`/`supported` or `partial`/`emerging`.
- `evidenceCoverage` — `Σ levelValue(assessment.level) / (4 × criteria count)`, as a percentage (`levelValue`: strong=4, supported=3, partial=2, emerging/claim-only=1, not-addressed/conflicting=0).
- `confidence` — the mean confidence across every *addressed* criterion (not-addressed criteria are excluded so an empty resume can't look artificially confident), minus up to 20 points for pool-level contradiction flags not tied to a specific criterion.
- `unadjustedConfidence` / `confidenceReduction` — the same mean *before* the contradiction penalty, so the UI can show exactly how many points a flag cost.
- **band**: `Leading match` (4+ required-strong, zero unsupported claims, zero flags) → `Strong match` (3+ required-strong) → `Promising match` (2+ required-strong, or 4+ combined strong+partial) → `Developing match` (everything else).

`screenPool(candidates, requisition)` maps every candidate through `screenCandidate` and sorts by band, then required-strong count, then evidence coverage.

`getPoolInsights(screened, requisition)` aggregates per-criterion across the whole pool: how many candidates are strong/partial/claim-only, coverage %, and whether it's a **pool-wide gap** (a required criterion zero candidates meet — flagged as a requisition problem, not a candidate failure).

## Contradiction detection

**`src/contradictions.js`** — pure text analysis, no model involved.

- `sourcePassages(text)` splits the resume into addressable passages, each tagged with a section (SUMMARY, EXPERIENCE, COVER NOTE, etc., detected via a heading regex), a line number, and exact character offsets — this is what makes every flag's citation clickable back to the exact source line in the UI.
- `dateBlocks(passages, now)` finds `YYYY–YYYY` / `YYYY–present` ranges (excluding the EDUCATION section) and computes generous year-only durations, merging overlapping ranges (`unionYears`) so two overlapping jobs don't double-count experience.
- `detectContradictions(text, requisition, now)` produces flags for:
  - **`duration-conflict`** — two passages state different explicit years-of-experience for the same skill, without one being a "professional" qualifier that would explain the gap.
  - **`duration` (unsupported)** — a claimed duration (e.g. "5 years of Python") exceeds the total dated experience the resume actually documents for that skill, with a generous year-only tolerance.
  - **`conflicting-passages`** — a positive claim and an explicit denial about the same skill/scope appear in different passages, with no time qualifier ("before", "since") that would resolve it.
  - **`expertise` (unsupported)** — expertise language with matching criterion terms but zero action-verb evidence anywhere for that skill.
  - **`title-scope`** — a senior/lead/principal title followed later (same section) by an explicit statement limiting ownership ("only shadowed", "did not lead").
- Two intentional exclusions worth knowing: a `negation` regex is written to **not** match "rather than" (so "solid rather than exceptional" is read as a modesty qualifier, not a disclaimer — and is credited, not punished), and a time-qualified denial ("I had not worked with X *before* 2022") is never flagged, since a timeline-scoped statement isn't a contradiction.

Every flag carries `kind` (`contradictory` or `unsupported`), the exact `claim` and `evidence` passages (with section/line/offsets), a plain-English `assessment`, and a `confidenceCap`.

## Requisition analysis

**`src/requisitionAnalysis.js`** — `analyzeRequisition(screened, requisition)`:

- `documentedYears(candidate)` extracts explicit "`N years… experience`" and role-header (`— N years`) durations from non-education lines, and takes the max.
- **Structural conflicts** (shown before any shortlist): a junior-level role also requiring 5+ years' experience; a junior-level role also requiring a `stretch` criterion; an experience floor combined with a fixed salary cap (flagged as something the agent can't resolve — it can't infer market rates).
- **Requirement coverage**: for every required criterion and for the experience/salary constraints (when set), how many candidates in the pool meet it.
- **Per-candidate**: `unmetCriteria`, `unmetConstraints`, `strengths`, `fullyMeets` (zero unmet criteria *and* zero unmet constraints), `tradeoffs` (unmet criteria + unmet constraints + a note per claim-check flag).
- **`shortlist`** — the top 5 candidates sorted by required-criteria met, then fewest trade-offs. This is what powers the "Closest-fit shortlist" panel on the Pool Insights page (and its own Excel sheet).
- **`fullMatches`** / **`noFullMatch`** — whether anyone in the pool fully satisfies every required criterion and constraint; the UI shows this prominently as a shortlisting safeguard so no one assumes a "leading" candidate is automatically a full match.

## External verification

**`agent/verifiers.js`** (shared between the browser and the server — no duplicated logic):

- **`extractGithubUrl(text)` / `extractLinkedInUrl(text)`** — regex-scan the resume text for a `github.com/<handle>` or `linkedin.com/in/<slug>` reference (with or without the `https://` prefix), skipping known non-profile GitHub paths (`settings`, `topics`, `orgs`, etc.). This is checked automatically the moment a recruiter opens a candidate's verification panel — if the candidate wrote the link themselves, no one has to retype it.
- **`verifyGitHubProfile(profileUrl, requisition)`** — resolves a handle (from a bare handle or a full URL), fetches the public profile and up to 8 non-fork repos (name, description, language, topics, update date) from the GitHub REST API, and computes `criteriaSignals`: which requisition criteria each repo's name/description/language/topics touch, tagged with `source: 'GitHub'`, the exact `repo` name, and its URL — so every signal is traceable to one specific repository.
- **`searchGitHubProfiles(name)`** — the fallback when no link is in the resume: searches GitHub's public `/search/users` endpoint by the candidate's name (as the recruiter entered it) and returns candidate matches for the recruiter to look at. **It never auto-selects one** — the UI shows avatar + handle + a link, and only saves a profile when the recruiter clicks "Use this profile." This is a deliberate design choice: a common name could easily match a stranger, and the app's own safeguard is "never use... inferred identity."
- **`verifyLinkedInEvidence({ url, authorizedText, requisition })`** — never scrapes. With no `authorizedText`, it returns `needs-authorized-export` (or `needs-consent` with no URL either) and stops there. Only when a recruiter pastes text the candidate authorized does it compute `criteriaSignals` the same way as GitHub.

**The confidence cross-check** (`applyExternalCorroboration` in `src/screening.js`): when a candidate has verification signals, each matching criterion can be promoted **one step** up a fixed ladder (`not-addressed → claim-only → emerging → partial → supported → strong`), capped so it can **never reach `strong`** on external evidence alone, and confidence is raised to `min(80, confidence + 10)` (never lowered — `Math.max` against the original). A criterion already at `conflicting` is left untouched entirely — external evidence never overrides a resume contradiction. Every promoted assessment gets an `externalCorroboration` array (source, repo, repo URL, matched terms) and a `reason` suffix naming exactly which repo (or the LinkedIn export) backed the change — rendered in the UI under "Cross-checked against external evidence," and exported to Excel.

## Resume upload & text extraction

**`extractFileText(file)`** in `src/App.jsx`:

- **`.txt` / `.md`** — read as-is.
- **`.pdf`** — uses `pdfjs-dist` in the browser. Text items come out of the PDF in drawing order, which can separate a bullet's action from its outcome, so rows are reconstructed by grouping items with the same y-coordinate (within 2px) and sorting left-to-right within each row before sorting rows top-to-bottom. It also reads every page's **link annotations** (`page.getAnnotations()`) and appends their target URLs as a `LINKS` block at the end of the extracted text — this is what lets `extractGithubUrl`/`extractLinkedInUrl` find an icon-only hyperlink (no visible URL text, just a linked glyph) that plain text extraction would otherwise miss entirely.
- **`.docx`** — `mammoth.extractRawText`.

The upload modal (`UploadModal`) validates: only `.pdf/.docx/.txt/.md`, 10 MB per file, a cover note can only be attached to a *single* uploaded resume (so evidence never gets mixed between two candidates), pasted text has a 250,000-character cap, and the salary field must be blank or a non-negative number. The candidate's display name is auto-detected — from a name-shaped line in the file, or (for pasted text with no file) from the pasted text itself — the same `detectName` logic runs whichever path was used, so a pasted resume gets the candidate's real name instead of a generic placeholder.

## LangChain agent

Two implementations of the same 3–4 node graph, so the feature works with or without the server running:

**Server-side** (`agent/orchestrator.js`, `createScreeningAgent`):
1. **Application intake** — records how many source lines were retained.
2. **Evidence & contradiction review** — runs `screenCandidate` and records how many criteria were assessed and how many claim checks were cited.
3. **Human-review decision** — deterministic policy: any contradictory flag → "Hold for human validation"; 3+ required-strong → "Shortlist for recruiter review"; otherwise → "Keep in reviewed pool." **Never** emits a hire/reject decision.
4. **Optional grounded-summary node** — only runs when `useModel` is true (`Boolean(process.env.OPENAI_API_KEY)` by default). Uses `ChatOpenAI` with `withStructuredOutput` to write a ≤500-character recruiter summary, explicitly instructed to use only the supplied evidence, never infer missing experience, never make a hiring decision, and name material trade-offs. If it errors, `modelStatus` records why and the deterministic recommendation is still returned unaffected.

The result deliberately excludes the input candidate/requisition and the full recomputed assessment — only `{ recommendation, trace, narrative, modelStatus }` — so storing it on `candidate.agentReview` can't recursively nest the whole application into itself on every re-run.

**Browser-side fallback** (`src/browserAgent.js`, `runBrowserLangChain`) — the same 3-stage shape (intake → evidence review → policy), but works off the *already-computed* `candidate.assessments`/`flags` instead of recomputing them, and never sends anything over the network. `App.jsx`'s `runAgent` always tries the server API first (when configured) and falls back to this automatically on any failure.

## Excel export

**`src/reportExport.js`** — `downloadScreeningWorkbook(data)` builds a `.xlsx` via `exceljs`, client-side, and triggers a browser download. `safeSpreadsheetCell(value)` prefixes any string starting with `=`, `+`, `-`, or `@` with a `'` so untrusted resume text can never become a spreadsheet formula (`=HYPERLINK(...)` and similar) when opened in Excel/Sheets. Ten sheets, in order:

1. **Summary** — generated-at timestamp, requisition title, pool size, strong-match count, total claim checks, full-requisition-match count, the shortlisting safeguard sentence, and any pool-wide gaps.
2. **Shortlist** — every candidate, ranked, with band, required-strong, evidence coverage, confidence, whether they fully match the requisition, strengths, trade-offs, and claim-check count.
3. **Closest-fit shortlist** — the top-5 `requisitionAnalysis.shortlist`: rank, candidate, "required met" as `X/Y`, total applicants in the pool, strengths, trade-offs.
4. **Criterion evidence** — one row per candidate × criterion: assessment level, confidence, recognized equivalent terms, cited evidence quotes, **external corroboration** (which repo, if any), and the rationale sentence.
5. **Claim checks** — every contradiction/unsupported-claim flag: the claim, its exact source line, the evidence reviewed, and the assessment.
6. **Requisition analysis** — structural conflicts plus coverage for every required criterion and constraint.
7. **Criterion coverage** — every criterion in the requisition (including preferred ones, which sheet 6 excludes), with supported/partial/missing counts and a pool-wide-gap flag.
8. **External evidence review** — every candidate's GitHub/LinkedIn verification status, source profile/URL, matched terminology signals, and a recruiter note.
9. **Agent reviews** — the LangChain recommendation, mode, model status, narrative, and full execution trace per candidate ("Not yet run" for anyone who hasn't been processed).
10. **Interview recommendations** — per shortlisted candidate, one suggested interview question per claim-check flag (priority: High), per unmet required criterion (Medium), and per unmet constraint (High) — or one general-depth question if nothing specific was flagged.

Every sheet has a frozen header row, alternating-row shading, autofilter, and a fallback "No records for this section" row so an empty sheet never renders as a blank, broken table.

## Server API

**`server/index.js`** — Express, CORS-enabled, 2 MB JSON body limit. All routes are stateless; nothing is persisted server-side.

| Route | Method | Body | Does |
|---|---|---|---|
| `/api/health` | GET | — | `{ ok, service, llmSummaryEnabled }` — whether `OPENAI_API_KEY` is set |
| `/api/agent/screen` | POST | `{ candidate, requisition }` | Runs the full LangChain agent, returns the recommendation/trace/narrative |
| `/api/verify/github` | POST | `{ profileUrl, requisition }` | Runs `verifyGitHubProfile` |
| `/api/verify/github/search` | POST | `{ name }` | Runs `searchGitHubProfiles`, returns `{ results }` |
| `/api/verify/linkedin` | POST | `{ url, authorizedText, requisition }` | Runs `verifyLinkedInEvidence` |

`VITE_AGENT_API_URL` (unset by default) tells the client where to reach this API; with it unset, every one of these falls back to running the same logic directly in the browser.

## UI component reference

All in **`src/App.jsx`** (612 lines, one file by design for a project this size):

| Component | Role |
|---|---|
| `Avatar` | Deterministic-color initials badge from a candidate's name |
| `LevelPill` | Colored pill for an assessment level |
| `Modal` | Base modal: focus trap (Tab cycles within it), Escape to close, click-outside to close |
| `Topbar` / `Sidebar` | App chrome — nav, help, export, add-applicants, mobile hamburger |
| `RequisitionHeader` | Title, applicant/strong-match/claim-check counts, filter shortcuts |
| `CandidateRow` | One row in any candidate list — click opens the detail modal, checkbox adds to compare |
| `PoolGap` | Banner for a required criterion nobody meets |
| `Overview` | Landing view — metric cards, pool gap, top-5 shortlist, trade-off cards |
| `Candidates` | Full searchable/filterable candidate list |
| `Insights` | Requisition health — shortlisting safeguard, structural conflicts, requirement coverage, closest-fit shortlist, pool gaps, per-criterion coverage bars |
| `CandidateDetail` | The full evidence panel — criterion assessments (with external corroboration), claim checks, and a line-numbered source view that jumps to the cited line |
| `UploadModal` | Add applicants — drag/drop files or paste text, with all the validation described above |
| `EditRequisition` | Edit title, team, constraints, and every criterion's name/description/aliases |
| `CompareModal` / `CompareTray` | Side-by-side trade-off comparison for up to 3 selected candidates |
| `HelpModal` | "How the screening works" — the in-app explanation of every scoring stage, including the external cross-check |
| `VerificationModal` | The GitHub/LinkedIn panel: auto-detects a resume link and verifies automatically, or searches by name with recruiter confirmation |
| `AgentOperations` | LangChain run queue — one-click run/re-run per candidate, with the node graph explained |
| `App` (default export) | Owns all state (`candidates`, `requisition`, `activeCandidateId`, etc.), derives `screened`/`insights`/`requisitionAnalysis` via `useMemo`, persists to `localStorage` |

`activeCandidateId` (not a candidate snapshot) is the source of truth for which candidate's detail view is open — the actual candidate object is always looked up fresh from the live `screened` array, so a verification or agent-run update is reflected immediately without a stale, hand-patched copy drifting out of sync.

## File-by-file guide

```
src/
  App.jsx (612 lines)              Every UI component — see the table above
  screening.js (248 lines)          Criterion scoring, contradiction-aware confidence,
                                     external-corroboration cross-check, fit bands, pool sort
  contradictions.js (109 lines)     Source-passage indexing + all contradiction/claim rules
  requisitionAnalysis.js (59 lines) Requirement conflicts, pool feasibility, closest-fit shortlist
  reportExport.js (175 lines)       The 10-sheet Excel workbook builder
  browserAgent.js (44 lines)        Client-side LangChain fallback (no network)
  data.js (121 lines)               Sample requisition + 12 hand-written demo candidates
  contradictionSamples.js (39 lines) 3 more candidates engineered to trigger specific claim checks
  main.jsx (10 lines)                React root

agent/
  orchestrator.js (86 lines)        Server-side LangChain agent (4-node RunnableSequence)
  verifiers.js (95 lines)            GitHub/LinkedIn verification, link extraction, name search

server/
  index.js (35 lines)                Express API — see the routes table above

tests/                              31 tests total — see Testing below
sample-resumes/                     Example resumes for manual testing
build_kabir_cv.py                   Generates one of the sample-resumes files (DOCX/PDF)
AGENT_ARCHITECTURE.md               Earlier architecture note (agent graph + safeguards)
design-system/verity/               Design-system reference notes from an earlier design pass
.env.example                        OPENAI_API_KEY / OPENAI_MODEL / AGENT_PORT
.claude/launch.json                 Browser-preview config for Claude Code (dev tooling only)
```

## Testing

```bash
npm test
```

31 tests across 5 files, run with Node's built-in `node:test` (no external test framework):

- **`agent.test.js`** — the LangChain workflow's trace/recommendation shape and that it never leaks `candidate`/`requisition`/`assessment` back out; that LinkedIn refuses to work from a URL alone; that a non-GitHub URL is rejected before any network call is made.
- **`contradictions.test.js`** — the timeline-contradiction example, resume/cover-note conflicts, title-scope and course-only-expertise flags, overlapping-role de-duplication, that education dates never establish skill duration, that different skills in the same criterion don't falsely conflict, exact source-offset citation, and the negation-vs-"rather than" distinction.
- **`requisition-analysis.test.js`** — no-full-match detection, junior/experience/salary conflict flags without inventing salary data, the ≥10k-request-scale rule for multi-region, plain-language experience floors, em-dash role-header durations.
- **`report-export.test.js`** — every sheet is present in order and none render empty; untrusted text can't become a formula; the new Closest-fit shortlist and Criterion coverage sheets carry the right data.
- **`screening.test.js`** — the external-corroboration promotion (one step, cited to the repo), that it's capped below `strong`, that it never overrides a `conflicting` criterion, and that a candidate with no verification data scores identically to before the feature existed.

## Tooling & configuration

- **Build**: Vite (`vite.config` inferred by the `@vitejs/plugin-react` default — no custom `vite.config.js` beyond the plugin).
- **Lint**: `eslint.config.js` — `@eslint/js` recommended rules, `eslint-plugin-react-hooks` (recommended, including the strict `set-state-in-effect` and `rules-of-hooks` checks), `eslint-plugin-react-refresh`. `no-unused-vars` ignores `_`-prefixed names.
- **Scripts** (`package.json`):

  | Command | Does |
  |---|---|
  | `npm run dev` | Vite dev server (client only) |
  | `npm run dev:agent` | Express agent API only |
  | `npm run dev:full` | Both, concurrently |
  | `npm run build` | Production client bundle |
  | `npm run preview` | Preview the production build |
  | `npm test` | Full test suite |
  | `npm run lint` | ESLint |

- **Key dependencies**: `react`/`react-dom`, `vite`, `lucide-react` (icons), `pdfjs-dist`, `mammoth`, `exceljs`, `langchain` + `@langchain/openai`, `zod` (structured LLM output), `express`, `cors`, `dotenv`, `concurrently` (dev).

## Safeguards & design principles

- **GitHub**: read-only public profile and repository metadata only. Cannot prove authorship, employment, or proficiency. Never auto-picks a profile from a name search — a human always confirms.
- **LinkedIn**: no scraping, ever. Only a candidate-authorized text export the recruiter pastes in is compared.
- **External evidence is bounded**: a cross-check can raise a criterion's confidence by a small, capped amount and promote it by at most one level — never enough to erase a resume contradiction, and never all the way to `strong` on its own.
- **No fabricated evidence**: every quoted passage is a verbatim slice of the submitted application, addressable by exact character offset and line number.
- **Confidence ≠ truthfulness**: confidence reflects how well an application (plus any verified external evidence) supports a claim, not the probability the candidate is being honest. Human review remains the final decision.
- **No composite score**: fit is deliberately kept multi-dimensional (band, required coverage, evidence confidence, pool gaps) rather than collapsed into one number that would hide trade-offs.

## Known limitations

- **State is per-browser, not shared** — `localStorage` only, no backend database. Two recruiters on different machines see different pools.
- **GitHub's unauthenticated rate limit is 60 requests/hour** — each verification or name search costs one or two requests against that shared limit; heavy use in one browser session can exhaust it (the app surfaces a specific rate-limit message when this happens rather than a generic error).
- **Resume parsing is best-effort** — a scanned (image-only) PDF has no extractable text and the upload will ask for pasted text instead; PDF row-reconstruction and DOCX extraction are heuristic, not a guarantee of perfect layout fidelity.
- **The alias/evidence-word lists are English-language and reasonably broad but not exhaustive** — a criterion or evidence phrasing outside the built-in vocabulary won't be recognized until an alias is added via **Edit requisition**.
- **The optional LLM node only summarizes** — it cannot add, remove, or override any deterministic finding, by design; if you need it to reason more deeply, that would be a deliberate architecture change, not a config flag.

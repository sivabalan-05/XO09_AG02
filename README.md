# Are You Winning Son
### PS02 — Autonomous Talent-Acquisition Screening Agent

---

## 1. What this actually does

A recruiter has one job opening and twelve applications. Some candidates are padding. Some are describing the same skill in different words. Some are genuinely good but wrote a short CV.

This system reads each application and answers one question before anything else:

> **How much of this should I believe?**

It then reports what each candidate can actually be trusted to do, shows the exact line of the resume behind every judgement, and flags requirements that *nobody* in the pool can satisfy.

---

## 2. Why the obvious approach fails

The obvious approach is to match keywords from the job description against the resume. Here is what that does to three of our candidates:

| Candidate | What a keyword matcher sees | What is actually true |
|---|---|---|
| **A-01** | "Kubernetes" ×3, "Distributed Systems" ×3 → **strong match** | Never touched either. The mentions are all in his own summary and skills list. |
| **A-02** | The word "Kubernetes" appears **zero times** → **no match** | Ran a 40-service production container platform for three years. |
| **A-03** | Modest wording, few buzzwords → **weak match** | Personally led a 140-service migration and cut cloud spend 38%. |

A keyword matcher gets **all three backwards.** It promotes the padder and rejects the two strongest candidates.

The reason is that it counts *mentions*. A mention is something the candidate wrote about themselves. It is not evidence.

---

## 3. The one idea

**Never let a claim and its evidence live in the same place.**

The system reads them separately, from different sections, using different code:

| | Read from | What it measures |
|---|---|---|
| **Claim** | summary, skills list, cover note **only** | How loudly you rate yourself |
| **Evidence** | the entire application | What the document actually proves |

Then it subtracts one from the other. That subtraction is the whole product.

```
support_gap  =  asserted_level  −  supported_level
```

Everything else in this README is a consequence of that one decision.

---

## 4. Watch it work — one resume, end to end

Following **A-01**, the padder, through all nine stages. Every value below is real output, not an illustration.

His cover note says:

> *"I am an expert in distributed systems with deep expertise in Kubernetes at production scale."*

### Stage 1 — Split the document into citable spans

Every sentence and bullet gets a permanent ID. This is what makes every later statement traceable.

```
A-01:summary.1     [summary   ]  Expert in distributed systems and large-scale cloud architecture.
A-01:summary.2     [summary   ]  Deep expertise in Kubernetes, service mesh design, and infrastructure automation.
A-01:skills.1      [skills    ]  Kubernetes
A-01:skills.5      [skills    ]  Distributed Systems
A-01:education.2   [education ]  Coursework: CS-6210 Advanced Operating Systems, CS-6250 …, Distributed Systems Seminar
A-01:cover_note.1  [cover_note]  I am an expert in distributed systems with deep expertise in Kubernetes…
```

Notice the section label on each. It matters enormously and costs nothing.

### Stage 2 — Extract claims, from assertion sections only

```
distributed_systems   asserted = expert      from A-01:summary.1
kubernetes            asserted = expert      from A-01:summary.2
kubernetes            asserted = expert      from A-01:cover_note.1
```

The word "expert" is a **self-rating**. It is recorded as a claim, and it now has to be paid for.

### Stage 3 — Harvest evidence, from the whole document, independently

```
distributed_systems   E0   A-01:summary.1      'distributed systems' in summary
distributed_systems   E0   A-01:skills.5       'Distributed Systems' in skills
distributed_systems   E1   A-01:education.2    'Distributed Systems' in education     ← the best he has
distributed_systems   E0   A-01:cover_note.1   'distributed systems' in cover_note

kubernetes            E0   A-01:summary.2      'Kubernetes' in summary
kubernetes            E0   A-01:skills.1       'Kubernetes' in skills
kubernetes            E0   A-01:cover_note.1   'Kubernetes' in cover_note              ← nothing above E0
```

Three of his four "distributed systems" mentions are **him saying so**. Those are E0 — a bare self-assertion. The single real one is a line of coursework, which is E1.

For Kubernetes there is nothing at all above E0. He never describes doing it anywhere.

### Stage 4 — Subtract

```
kubernetes            UNSUPPORTED   asserted=expert  supported=mentioned   gap = +4
distributed_systems   UNSUPPORTED   asserted=expert  supported=familiar    gap = +3
```

He is not rejected for lacking the words. He is downgraded because **the only thing backing the word is the word itself.**

### Stages 5–9 in one line each

- **5. Criteria** — fails the Kubernetes requirement; `RequiredCoverage 0.00`
- **6. Fit vector** — four separate numbers, no overall score
- **7. Confidence** — 34%, driven down by how many of his own claims collapsed
- **8. Trade-offs** — dominated by others, so not on the shortlist frontier
- **9. Citations** — every statement above re-verified against his original file

**Result:** *do not advance* — with a receipt for every step.

---

## 5. Watch it not make the opposite mistake — A-02

A-02's application contains the word "Kubernetes" **zero times.** A keyword matcher rejects him instantly. Here is what this system does:

```
R1 (Kubernetes requirement)   met: True   best_tier: E4   coverage: 1.00
route: AWS ECS / Fargate → kubernetes via implies (w=0.75), E4 → effective E4
cited: A-02:exp.1.b1
```

That cited span reads:

> *"I led the migration of a 40-service monolith-to-microservices fleet onto ECS Fargate, cutting deploy time from 45 minutes to 6."*

He **meets the requirement in full**, and the report names the exact route it used, so a human can audit the decision.

**Why direction matters.** The ontology has three relation types, and `implies` is deliberately **one-way**:

- `alias` — same thing, different name. K8s ≡ Kubernetes ≡ EKS.
- `implies` — running production ECS/Fargate *implies* orchestration competence. **Kubernetes does not imply ECS.**
- `adjacent` — neighbouring skill, partial credit only.

If `implies` ran both directions, the system would start crediting people with experience they never claimed. That is the line between recognising equivalence and inventing it.

---

## 6. How evidence gets its tier

The tier comes from **where a span sits** and **what it demonstrates** — never from how confidently it is written.

| Tier | Meaning | Example |
|---|---|---|
| **E4** | Production work with scope, ownership **and** an outcome | *"I led the migration of 140 services… zero downtime"* |
| **E3** | Substantial project or professional work | *"I run the Kubernetes staging cluster"* |
| **E2** | Academic project, certification, training | CKA, CKAD, a home lab |
| **E1** | Coursework mention or stated familiarity | *"Coursework: … Distributed Systems Seminar"* |
| **E0** | Bare keyword or self-assertion | `Kubernetes` in a skills list |

Three adjustments, each recorded and cited:

| Signal | Effect | Why |
|---|---|---|
| ownership **+** quantified outcome | **+1 tier** | You did it and you can say what happened |
| "our team migrated…", "helped with…" | **−1 tier** | Real work, but your individual share is unclear |
| "worked on", "responsible for", "exposure to" | **−2 tiers** | Describes proximity to work, not performance of it |

> **A-07** wrote *"Our team migrated the estate to Kubernetes, scaling to 10 million users."* That is a genuine achievement, so it is not thrown away — but it drops to E2 and the requisition's personal-leadership constraint is marked unmet. The report says exactly why.

---

## 7. Two distinctions most screeners get wrong

**A disclaimer is not evidence.**
A-12 writes *"I have not worked in a FedRAMP or GovCloud environment."* A naive matcher counts that as a FedRAMP hit. This system detects negation per clause and scores it as zero.

**A modesty qualifier is not a disclaimer.**
A-03 writes *"solid rather than exceptional."* That is not a statement of absence, and treating it as one would punish exactly the understated candidates worth finding. The negation detector deliberately excludes "rather than" — and there is a test asserting it.

> **A-03's verdict: UNDERSTATED.** She rates herself *proficient*; her evidence supports *expert*. She is **credited upward, at the level her evidence supports.**

---

## 8. Padding is caught by arithmetic, not by judgement

*"6+ years of production Kubernetes"* reads perfectly fluently on a CV whose first job started 39 months ago. A language model reads straight past it. Date arithmetic never does — so the timeline checker is plain Python with no model involved.

**A-05 was caught four independent ways:**

| Check | Finding |
|---|---|
| Total experience | Claims 8 years; his listed roles total **37 months** |
| Skill years vs career | Claims 6 years of Kubernetes; entire career is **3.2 years** |
| Technology anachronism | Claims Terraform **since 2012** — Terraform did not exist until **2014** |
| Since-year vs career | Implies 14 years of use against a 3.2-year career |

A `CONTRADICTED` verdict **overrides everything else**, however impressive the described work reads. And because his dates cannot be trusted, he is also removed from the pool's capacity count for every requirement.

**Zero false positives on the other eleven candidates.** A-09 claims fourteen years; his roles sum to exactly 168 months, and he passes clean.

---

## 9. Why there is no single score

Fit is **four independent numbers**, and confidence is reported **separately and never multiplied in**:

`RequiredCoverage` · `EvidenceQuality` · `SeniorityMatch` · `TrajectoryRisk`

That separation lets the system say two things a single score structurally cannot:

> **A-11 — high fit, 57% confidence.** A one-page CV where every line is E4. He is not weak; there is simply less material to assess. **Low confidence describes the document, not the person.** Collapse these into one number and he silently drops below candidates who wrote more.

> **A-09 — RequiredCoverage 0.84, SeniorityMatch 0.29.** Fourteen years against a 2–4 year band. Averaging would hide either his strength or his misfit. Keeping the axes apart shows both at once.

**Shortlisting uses a Pareto frontier.** A candidate is on it when nobody else is at least as good on all four dimensions *and* better on one. Four survive — **A-02, A-03, A-09, A-11** — and the system states pairwise what actually differs instead of ranking them. Inside a tier, candidates are explicitly not ranked against each other.

---

## 10. The agent cannot invent evidence

Every statement carries span IDs. After the run, `validate.py` re-opens the original files and asserts each cited span **exists** and its text appears **verbatim**.

```
Citation validation: 147 citations checked, ALL VERIFIED
```

The eval suite includes a **negative control** proving the guard actually rejects invented text. Without it, "all verified" would be a vacuous claim.

The optional LLM layer is bound by the same rule **in code, not in the prompt**: it may only cite span IDs it was handed, and any other ID is dropped and counted as a rejected hallucination.

---

## 11. It also screens the requisition

Transposing the matrix asks a different question: not *"is this candidate good enough"* but *"can anyone who applied answer this at all?"*

> **R5 (FedRAMP) is unmet by every single applicant.** The only positive mention anywhere in the pool sits inside A-04's unsupported keyword blob; A-12 mentions it only to disclaim it. Reported as a **requisition problem**, not a screening result — with recommendations to reclassify, train on hire, or re-source.

> **Requisition conflict.** R1 expects demonstrated migration leadership, but the seven applicants who actually evidence it have a **median of 4.8 years** — above the stated 2–4 year band. The two requirements pull against each other, and the pool itself is the proof.

---

## 12. Run it

No third-party dependencies. Python 3.10+.

```bash
python3 run.py
```

```bash
python3 tests/test_adversarial.py
```

```bash
python3 run.py --candidate A-01
```

`run.py` writes `out/report.html` and `out/assessments.json`. The eval suite runs **50 assertions — one per engineered trap — and all 50 pass.**

The `anthropic` SDK is needed only for the optional refinement layer:

```bash
python3 run.py --llm
```

---

## 13. Full results

Twelve applications, each built to defeat one specific naive-matcher assumption.

```
id    trap                   ReqCov EvQual Senior  Risk  Conf   outcome
A-01  padder                   0.00   0.00   0.98  0.33   34%   do not advance
A-02  synonym_hider            0.84   0.89   0.83  0.00   80%   advance
A-03  quiet_star               0.84   0.91   0.74  0.00   83%   advance
A-04  keyword_farm             0.25   0.25   1.00  0.27   37%   do not advance
A-05  timeline_contradiction   0.66   0.75   1.00  0.55   50%   do not advance
A-06  adjacent_domain          0.00   0.88   0.61  0.10   83%   do not advance
A-07  team_credit              0.50   0.50   0.77  0.20   45%   reservations
A-08  career_changer           0.66   0.81   0.61  0.20   74%   advance
A-09  overqualified            0.84   0.94   0.29  0.00   83%   advance
A-10  cert_heavy               0.24   0.50   0.81  0.20   42%   do not advance
A-11  sparse_document          0.66   0.92   1.00  0.10   57%   advance
A-12  near_miss                0.66   0.83   1.00  0.10   76%   advance
```

| ID | Trap | What must happen |
|---|---|---|
| A-01 | padder | "Expert in distributed systems" → UNSUPPORTED on one course |
| A-02 | synonym hider | Meets R1 without the word appearing |
| A-03 | quiet star | UNDERSTATED — credited above her self-rating |
| A-04 | keyword farm | 65 skill tokens, coverage stays 0.25 |
| A-05 | timeline liar | CONTRADICTED, 4 independent failures |
| A-06 | adjacent domain | Deep expertise, wrong domain for *this* req |
| A-07 | team credit | Ownership unmet, hard constraint HC1 fails |
| A-08 | career changer | OSS provider → E4; staging-only k8s → E3 |
| A-09 | overqualified | Seniority mismatch surfaced separately |
| A-10 | cert heavy | Certifications capped at E2 |
| A-11 | sparse doc | High fit, low confidence |
| A-12 | near miss | Meets R1–R3, misses R4 |

---

## 14. Constraint compliance

| Constraint from the problem statement | How it is enforced |
|---|---|
| Unsupported claims must not carry the same confidence as evidenced ones | Separate code paths, `support_gap` subtraction, five explicit verdicts |
| Must not penalise equivalent skills described differently | Typed directional ontology; A-02 meets R1 with zero keyword hits |
| Must not collapse fit into one opaque score | Four dimensions + separate confidence + Pareto frontier; a test asserts no `score` field exists |
| Must not fabricate evidence | `validate.py` verbatim guard, 147/147, plus a negative control |
| Demonstrable within 24 hours | Zero dependencies, sub-second run, 50-assertion suite |

---

## 15. Questions you will be asked

**"Isn't this just an LLM call?"**
No. Span indexing, timeline arithmetic, ontology traversal, Pareto computation, gap analysis and citation validation are all plain Python. Those are facts, not judgements — a model would only add variance and cost. The LLM layer runs only on the residual: phrases the curated ontology could not resolve.

**"How do you know it isn't hallucinating?"**
Every statement carries span IDs that are re-verified verbatim against the source after the run, and a negative control in the test suite proves the guard rejects invented text.

**"What if a candidate just words things differently?"**
That is A-02. He never writes "Kubernetes" and still meets the requirement in full, via a typed `implies` edge that the report names explicitly.

**"Why not one score? It's easier to sort."**
Because A-11 would disappear. High fit, low confidence is a real and common state, and one number cannot express it.

**"How do you know it works?"**
Every candidate is an engineered adversarial test case, and the suite asserts each specific trap fires: 50 assertions, all passing.

---

## 16. Architecture

```
data/requisition.json          5 required + 4 preferred criteria + 1 hard constraint
data/applications/A-*.md       12 engineered applications

src/talentscreen/
  ingest.py       Stage 1  span indexing — every unit gets a stable id (A-03:exp.1.b1)
  claims.py       Stage 2  claim extraction (assertion sections only) + Stage 4 reconciliation
  evidence.py     Stage 3  tiering: ownership, metrics, vagueness, team credit, disclaimers
  ontology.py              typed directional equivalence graph + self-rating lexicon
  timeline.py              deterministic date arithmetic — no model
  fit.py          Stages 5-7  criterion matching, 4-dim fit vector, confidence
  tradeoffs.py    Stage 8  Pareto frontier + pairwise trade-off statements
  poolgap.py               requirement gap matrix + requisition conflict detection
  validate.py     Stage 9  citation verbatim guard
  llm.py                   optional refinement layer — cached, citation-constrained
  report.py                self-contained HTML report

tests/test_adversarial.py      50 assertions, one per engineered trap
out/report.html                generated report
```

**Pipeline:** span index → claim extraction → evidence tiering → terminology equivalence → reconciliation → fit vector & confidence → Pareto & trade-offs → pool gap analysis → citation validation.

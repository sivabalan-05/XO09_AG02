# Verity — evidence-first applicant screening

Verity is a hackathon-ready browser application for screening resumes against a job requisition without trusting keyword matches blindly.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. For a production bundle:

```bash
npm run build
npm run preview
```

## Demo flow

1. Start on **Overview** to see the ranked shortlist and the pool-wide requirement gap.
2. Open Maya Rao for a well-evidenced application.
3. Open Leena Thomas (A-07) to see an “expert” distributed-systems claim reduced to **Claim only** because it is supported only by coursework.
4. Open Noor Khan (A-03) to see terminology equivalence: Google Pub/Sub and event-driven pipelines map to distributed-systems evidence.
5. Select two candidates with the checkboxes and choose **Compare** for a criterion-by-criterion trade-off matrix.
6. Choose **Add applicants** and upload the included `sample-resumes/demo-priya-nair.txt`, or upload a PDF/DOCX/TXT/MD resume.
7. Open **Pool insights** to see why the production multi-region requirement is flagged as unmet by the entire pool.

## What is included

- One editable requisition with five required and two preferred criteria.
- Fifteen built-in sample applications with supported claims, unsupported claims, alternative terminology, academic experience, career changers, seniority trade-offs, and contradiction challenges.
- Local PDF, DOCX, TXT, and Markdown resume parsing.
- Evidence extraction from the same application only.
- Synonym clusters editable per criterion.
- Six explainable evidence states: strong, supported, partial, emerging, claim-only, and not addressed.
- Fit bands and shortlist ordering with visible coverage, confidence, strengths, and trade-offs.
- Pool-level requirement coverage and unmet-requirement detection.
- Responsive desktop, tablet, and mobile layouts.

## Screening method

The demo uses deterministic, inspectable heuristics so it works without API keys during a 24-hour hackathon. Each matching passage receives more evidence weight for action verbs, operating context, and measurable outcomes. Caveats, coursework, guided projects, and skill-list-only claims reduce evidence strength. Special ownership/scale criteria must satisfy every stated qualifier.

This is a decision-support prototype, not an autonomous hiring authority. A production version should add structured human review, bias testing, consent/retention controls, and model-quality monitoring.

## Surprise Challenge 01: contradiction detection

Open **Candidates** and enable **Only candidates with claim checks**. New built-in examples:

- **A-13, Priya Das:** five years of Python claimed, but only a 2024–2025 internship documented. Flagged as unsupported, not proven false. The education range does not establish Python experience.
- **A-14, Rohan Kapoor:** production AWS deployment in the resume conflicts with an explicit denial in the cover note.
- **A-15, Tara Menon:** senior title with explicitly limited responsibilities, plus expert distributed-systems claim supported only by coursework.

Each flag includes the literal claim, reviewed source passages, section and line references, an explanation, and confidence impact. Click a reference to highlight its original source line. Conflicting criteria cannot count as strongly supported in shortlist or pool coverage. Candidate confidence averages addressed criteria only, so confident detection of missing information cannot inflate confidence in the applicant's claims.

To cross-check your own resume and cover note, upload **one** resume and paste its cover note in the upload dialog. Both are evaluated as one application. Uploading several files with one shared note is rejected to avoid mixing applicant evidence.

The detector uses conservative rules for numeric experience durations, overlapping year ranges, explicit positive/negative statements, course-only expertise, and explicit title/responsibility limits. It does not establish whether claims are truthful, infer dates from education, or claim exhaustive semantic contradiction detection. Year-only ranges use generous upper bounds; undated experience remains unverified. Percentages are heuristic confidence indicators, not calibrated probabilities. Scanned PDFs without a text layer require pasted text.

Run regression checks with `npm test`. They cover the challenge examples, exact source offsets, same-line conflicts, confidence reductions, and false-positive cases such as pre-graduation projects, overlapping jobs, different skills, academic versus production scope, and time-qualified denials.

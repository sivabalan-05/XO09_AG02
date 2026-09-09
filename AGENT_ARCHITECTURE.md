# Verity autonomous screening agent

Verity is an evidence-first talent-acquisition prototype. It does not make a hiring decision. Its autonomous job is to organize evidence, flag conflicts, call approved evidence tools, and produce a traceable recommendation for a recruiter.

## Stack

- React + Vite client
- Express API service
- LangChain `RunnableSequence` orchestration
- Optional `ChatOpenAI` grounded-summary node (enabled only when `OPENAI_API_KEY` is set)
- PDF.js and Mammoth for local PDF/DOCX extraction
- GitHub REST API for public repository metadata
- Browser localStorage for demo-only state persistence

## Agent graph

1. **Application intake** retains the source application text and counts source lines.
2. **Evidence and contradiction review** maps requisition aliases, assesses action/context/outcome evidence, and cites any contradiction with exact source lines.
3. **Decision policy** produces a human-review recommendation: shortlist, hold for validation, or keep in reviewed pool. It never emits hire/reject.
4. **Optional grounded-summary node** asks the LLM only to summarize the evidence already supplied by stages 1–3. It cannot enrich the application or override the policy result.

The first three stages are deterministic and work without an API key. LangChain still orchestrates the workflow through named runnable nodes. The model-enhanced summary is deliberately optional, so the demo remains functional and auditable offline.

## External-evidence safeguards

### GitHub

The GitHub tool accepts a candidate-provided public handle/URL and reads public profile plus recent non-fork repository metadata. It returns links, description, declared language, topics, update date, and transparent requisition-alias signals for recruiter review. It does **not** claim to prove identity, authorship, employment, or proficiency.

### LinkedIn

The application does not scrape LinkedIn. A recruiter can paste a candidate-authorized profile export and optionally record the public profile URL. This is a demonstrable consent flow for the hackathon. A production OAuth connection must use an approved LinkedIn partner integration and the candidate's authorization.

External evidence is kept separate from the resume fit score until a human reviews it.

## Run locally

```bash
npm install
npm run dev:full
```

This starts the React client and the agent API together. Open the Vite URL printed in the terminal. For a grounded LLM summary, copy `.env.example` to `.env` and set `OPENAI_API_KEY`; do not put the key in client code.

## Checks

```bash
npm run build
npm test
```

The test suite covers duration support, education-date protection, overlapping roles, explicit passage conflicts, title/scope conflicts, course-only claims, line citations, and confidence behavior.

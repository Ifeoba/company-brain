# Brain Spec v1.0

**A brain is a folder of files** that captures how one specific service gets done at one specific company — including the steps, the decisions, the rules no one wrote down, and the proof that the work actually happened. An AI agent reads this folder to do the work. A new team member reads it to learn the work. When the work changes, the brain changes.

## What a brain is not

- **A knowledge base.** A knowledge base answers questions. A brain makes decisions and executes work.
- **A chatbot over documents.** A brain has encoded judgment and discrete skills, not retrieval.
- **A general AI assistant configuration.** A brain is for one specific unit of work, narrowly scoped.
- **An SOP.** SOPs describe ideal-state behaviour. A brain captures how work *actually* happens, including the messy parts no one documented.

## The one-brain rule

One brain = one service. A service is a unit of work one person gets paid to do today.

"Handle company operations" is not a service. "Auto-draft the first reply to inbound billing support emails for paying customers" is.

If you find yourself describing two distinct triggers, two distinct deliverables, or two distinct sets of human actors — you have two brains. Split them.

## Folder structure

```
<service-slug>-brain/
├── 01-service-definition.md      required
├── 02-how-work-happens.md        required
├── 02-unwritten-rules.md         required
├── 03-decision-rules.md          required
├── 03-evals.json                 required
├── 04-skills.md                  required
├── 05-guardrails.md              required
├── 06-proof-log.md               required
├── brain-readme.md               required
└── progress.md                   optional — present only during active build
```

The folder name (`<service-slug>-brain`) is 2–4 words, lowercase, hyphenated, derived from the service definition. Confirm it once at the start and use it consistently.

---

## File specifications

### 01-service-definition.md — Service Definition

Pins exactly what this brain is for. Every other file in the brain is anchored to this definition.

**Required content:**
- One-sentence service definition: trigger + unit of work + deliverable
- Who does this work today (role or name)
- How often this work happens (frequency or trigger event)
- The deliverable — what "done" looks like, what format, who receives it
- Systems and tools this work touches
- At least two explicit out-of-scope statements

**Completeness bar:** Someone who has never met you can read this file and correctly name what the agent will do, what it won't do, and who currently does the work.

**Common failure:** A definition that could apply to any company ("handle support tickets"). It must be specific to this company's version of this work.

---

### 02-how-work-happens.md — Knowledge Layer: Structure

Captures the structure of the work — the steps, the systems, the handoffs. The "what actually happens" version, not the SOP version.

**Required content:**
- Step-by-step walkthrough from trigger to completion
- Systems and tools used at each step
- Roles involved at each step
- What counts as a successful completion
- What inputs the agent receives and in what format
- Common variations in how the work unfolds (not just the happy path)

**Source:** Direct observation or interviews with the person who does this work today. SOPs describe ideal state; this file describes what actually happens.

**Completeness bar:** An agent reading this file knows exactly how to start, what to do at each step, and how to tell when it's done. No step requires the agent to infer from context.

---

### 02-unwritten-rules.md — Knowledge Layer: Institutional Knowledge

Captures the operating knowledge that lives in people's heads, not in documents — the exceptions, the shortcuts, the things everyone knows but no one wrote down.

**Required content:**
- At least 5 rules or facts not in any official document
- At least 2 facts about specific customers, partners, or situations that require special handling
- At least 1 thing that looks like it should be done one way but is actually done differently
- Source annotation for each rule (who said it, in what context)

**Source:** Direct quotes or paraphrases from the person who does this work. Not inferred. Not hypothetical.

**Completeness bar:** A smart agent that read only the SOP would get some of these cases wrong. This file is what saves it.

**Common failure:** Generic rules that could apply to any company in this industry. If none of these rules require knowing anything specific about this company, the extraction was surface-level.

---

### 03-decision-rules.md — Judgment Layer: Rules

Encodes how decisions get made — not just the easy cases, but the hard ones, the edge cases, and the escalations.

**Required content:**
- Decision rules in IF / THEN / ELSE format for every non-trivial decision in the workflow
- At least 3 edge cases with explicit handling
- Escalation rules — what triggers escalation, to whom, in what format, with what information attached
- Rules for what to do when information is missing or ambiguous

**Completeness bar:** You can pick any case from `03-evals.json`, trace it through the rules in this file, and arrive at the correct answer without ambiguity.

---

### 03-evals.json — Judgment Layer: Test Cases

Test cases with known correct outcomes. The only way to know whether the brain actually works.

**Format:** See `spec/schemas/evals.schema.json`

**Required content:**
- At least 10 test cases
- At least 3 cases with `"difficulty": "hard"` — cases where the correct answer is non-obvious, or where a smart new hire would likely get it wrong
- Each case has: an input, an expected output, and a difficulty rating
- Cases are drawn from real historical work, not invented examples

**Completeness bar:** Running an agent on these cases and comparing its answers to `expected_output` tells you whether the brain is working. Every case has a verifiable right answer.

**Common failure:** All cases are the obvious, routine ones. Hard cases are the only ones worth testing — the routine ones take care of themselves.

---

### 04-skills.md — Action Layer

Defines what the agent will actually *do* — discrete, executable actions with clear inputs and outputs. Not descriptions of work; contracts for work.

**Required content:**
- Each skill has: name, trigger, inputs (with types), outputs (with types), tools used, and whether human approval is required before execution
- At least one skill per major step in `02-how-work-happens.md`
- Skills connect to real systems — not hypothetical ones
- Skills use abstract capability names (`send_message`, `lookup_record`) that the runtime maps to specific tools at deploy time

**Completeness bar:** Another developer could pick up this file and implement the skills without asking you anything. Each skill has an unambiguous contract.

**Common failure:** Skills are descriptions rather than contracts. "Look up the customer record" is not a skill. `lookup_customer(customer_id: string) → CustomerRecord` is.

---

### 05-guardrails.md — Guardrail Layer

Encodes the boundaries — what the agent decides alone, what it escalates, and what it never does.

**Required content — three explicit categories:**

1. **Agent decides alone:** Low-risk, reversible actions the agent takes without human approval. Name the conditions precisely.
2. **Escalates to human:** Actions that require human sign-off before proceeding. Name who receives the escalation, in what format, and what information must be included.
3. **Never does:** Hard constraints the agent must never cross, under any circumstances. No exceptions, no overrides.

**Completeness bar:** Every skill in `04-skills.md` maps unambiguously to one of the three categories. No skill sits in an undefined middle.

**Common failure:** Guardrails that exist in the author's head but not in the file. The test: if the agent read only this file, would it know what it cannot do? If not, the guardrails aren't real.

---

### 06-proof-log.md — Proof Layer

Documents real units of work the agent completed, with human verification.

**Required content:**
- At least one proof entry before a brain is considered production-ready
- Each entry: date, input used, what the agent did (step by step), what the human reviewed, sign-off (name of real person who verified it)
- Inputs must come from real company data — not synthetic examples
- Human sign-off must name a real person who inspected the output

**Completeness bar:** If someone auditing this brain asks "has this agent actually done this work?" — you can point to a specific entry with a named human who verified it.

**Common failure:** A polished demo on synthetic data. A demo is not proof. Proof requires real input, real output, real human verification.

---

### brain-readme.md — Brain Index

One-page summary of the brain — what it is, what's in it, who owns it.

**Required content:**
- One-sentence service definition (exact text from `01-service-definition.md`)
- Owner — the person responsible for keeping this brain current
- Table of contents with one-line description of each file
- How to use the brain
- Spec version this brain was built against

---

## Validation

A brain is ready when all six dimensions score Solid under the company-brain-validator:

| # | Dimension | Primary files |
|---|---|---|
| 1 | Service Definition | `01-service-definition.md` |
| 2 | Knowledge Layer | `02-how-work-happens.md`, `02-unwritten-rules.md` |
| 3 | Judgment Layer | `03-decision-rules.md`, `03-evals.json` |
| 4 | Skills | `04-skills.md` |
| 5 | Guardrails | `05-guardrails.md` |
| 6 | Proof | `06-proof-log.md` |

Solid means: someone unfamiliar with the work could read that file and use it to do or verify the work correctly. Anything below Solid is a gap to close before putting an agent on this brain.

## Building a brain

Use the templates in `spec/templates/` to scaffold a new brain folder. Each template file has prompts inside it.

The six-step build order follows the six dimensions above — complete them in order. Each step produces one artifact. By the end you have a folder that IS the brain.

For a guided build, use the `companybrain interview` CLI (see `builder/`).

## Versioning

This is Brain Spec v1.0. Record the spec version in `brain-readme.md` when you build a brain. When the spec updates, note which files need revision.

---
name: company-brain-validator
description: Validate whether the user has enough material and encoded decisions to actually have a "company brain" for a specific service — as opposed to a knowledge base, a doc dump, or a chatbot over PDFs. Use this skill whenever the user wants to check company brain readiness, audit their materials for a domain, validate a capstone submission against the company-brain framework, verify they have encoded judgment and skills not just retrieval, or asks anything like "do I have enough?", "is this a brain yet?", "is my company brain ready?", or "can I build an agent on top of what I have?" Runs in two modes — an interactive interview walking through validation questions one dimension at a time, and an audit mode that ingests user-supplied materials (docs, notes, transcripts, exports) and produces a readiness report across six dimensions covering service definition, knowledge extraction, judgment encoding, skills, guardrails, and proof of real work.
---

# Company Brain Validator

A skill to test whether the user actually has a **company brain** — an executable, decision-making operating map of how a specific service runs at a specific company — or whether they have a knowledge base, a doc dump, or a chatbot over PDFs.

The distinction is the whole point. A knowledge base answers questions. A brain makes decisions and executes work. This skill surfaces the gap honestly, so the user knows what's actually missing before they build an agent on top.

## How this skill works

The skill operates in two modes. **Always start by asking which mode the user wants** unless it is already obvious from context:

1. **Interview mode** — Walk the user through validation questions, one dimension at a time. Use when they have nothing concrete to upload yet, or want to think out loud.
2. **Audit mode** — Ingest their materials (docs, notes, transcripts, screenshots, exports, links) and assess them against the rubric. Use when they have artifacts to evaluate.

If the user wants both, do audit first (it grounds the conversation in real evidence) then move into interview mode for the dimensions where the materials were thin.

## The six validation dimensions

Validation is structured around six dimensions. The full rubric — with missing / partial / solid levels and concrete examples — lives in `references/rubric.md`. Read that file before scoring any dimension; do not score from memory.

1. **Service Definition** — Is the unit of work narrow, real, and paid for today?
2. **Knowledge Layer** — Has the messy operating knowledge been extracted from where it actually lives (interviews, Slack, email, spreadsheets, ticket history), or only from the official SOP?
3. **Judgment Layer** — Are decision rules, exceptions, and "what good looks like" encoded? Is there an eval set with known correct outcomes, including hard cases?
4. **Skills / Action Layer** — Are there discrete skills with clear inputs/outputs that connect to real systems? Can the agent execute, or only describe?
5. **Guardrails** — Is the line between "agent decides", "human decides", and "never do this" encoded in the brain itself, not just in the user's head?
6. **Proof** — Has the agent done a real unit of work that a human verified?

## Running interview mode

For each dimension, in order:

1. Read the relevant section of `references/interview-questions.md`.
2. Ask the [Open] questions first to let the user speak. Listen.
3. Probe with [Probe] questions only if the answer is fuzzy or surface-level.
4. After each dimension, give a one-line summary of what you heard, a tentative status (❌ Missing / ⚠️ Partial / ✅ Solid), and ask if it sounds right before moving on.

**Pin the service definition first.** If the service is fuzzy ("we automate finance"), do not move on. The rest of the validation is meaningless if the unit of work isn't crisp. Push until the user can name the trigger, the unit, and the output in one sentence.

Do not ask all questions in a section. Pick the ones that get you to a defensible score.

At the end, produce the readiness report (template below).

## Running audit mode

1. Ask the user to share their materials. Accept anything: uploaded files, pasted text, links to public docs, screenshots, transcripts. If the user says "I have a Notion / Google Drive", suggest they paste the relevant pages or export them.
2. Read the materials. For documents, read them carefully — don't skim. For long materials, identify which sections speak to which dimension.
3. For each of the six dimensions, evaluate what the materials demonstrate against `references/rubric.md`.
4. **Quote specifically.** Point to the file name, section, or line that supports each scoring decision so the user can verify. Vague feedback is useless feedback.
5. Where evidence is missing, say so. Do not fill in gaps with assumptions about what the user probably meant.
6. Produce the readiness report.

If materials clearly cover only one dimension (e.g., a 50-page knowledge dump with no eval set, no skills, no guardrails), name that directly. The verdict matters more than politeness.

## The readiness report

Use this exact template at the end of either mode. Adapt section content but keep the structure.

**The standard the user is being measured against is ✅ Solid on every dimension as defined in `references/rubric.md`.** That is the bar a reviewer or operator would defend as a real company brain. Anything below ✅ is a gap to close, and the report must spell out exactly what work closes it.

```
# Company Brain Readiness Report

**Service**: [the specific unit of work]
**Domain / company**: [if specified, else "not specified"]

## Verdict
[One of: "Not yet a brain — concept stage." / "Knowledge base, not a brain." / "Brain in formation — gaps remain." / "Brain ready — agent can execute on top."]

[One paragraph in plain language explaining why. Be specific to their situation.]

## Dimension scores

| Dimension | Status | What's there | What's missing |
|---|---|---|---|
| 1. Service Definition | ✅ / ⚠️ / ❌ | ... | ... |
| 2. Knowledge Layer | ✅ / ⚠️ / ❌ | ... | ... |
| 3. Judgment Layer | ✅ / ⚠️ / ❌ | ... | ... |
| 4. Skills / Action Layer | ✅ / ⚠️ / ❌ | ... | ... |
| 5. Guardrails | ✅ / ⚠️ / ❌ | ... | ... |
| 6. Proof | ✅ / ⚠️ / ❌ | ... | ... |

(✅ Solid, ⚠️ Partial, ❌ Missing)

## Work needed to reach the standard

For every dimension scored below ✅ Solid, include a block in this exact format. Skip dimensions already at ✅. Pull the "target state" language from the ✅ Solid level in `references/rubric.md`.

### [Dimension N: Name] — current ⚠️ Partial / ❌ Missing → target ✅ Solid

**The gap**: [One sentence naming exactly what is below standard. In audit mode, reference specific evidence in the materials. In interview mode, reference specific things the user said.]

**Target state**: [What ✅ Solid looks like for this dimension, in one or two sentences from the rubric.]

**Work to close the gap**:
1. [Concrete action. Name the artifact to produce, the person to interview, the file to write, the test to run.]
2. [Concrete action.]
3. [Concrete action, if needed.]

**Evidence the gap is closed**: [An inspectable artifact, test result, or sign-off that would let the user confirm this dimension is now ✅ Solid.]

## Priority order

Across all gaps above, the order in which to tackle them. Stop at the number that's actually high-leverage — usually 3, sometimes fewer.

1. **Start with [Dimension N]** because [what it unblocks for the others].
2. **Then [Dimension N]** because ...
3. **Then [Dimension N]** because ...

## The trap to watch for
[One paragraph naming the single most likely way this becomes a chatbot-over-docs instead of a brain. Be specific to the user's situation — generic warnings are noise.]
```

### How to write the "Work to close the gap" actions

The most common failure of this report is generic advice. Avoid it. Concrete actions beat conceptual ones, and they should reference the actual service the user is building for whenever possible.

**Bad**: "Improve the knowledge layer by adding more company-specific detail."
**Better**: "Interview the AR analyst (Priya) for 45 minutes. Capture which vendors get net-30 vs net-60, which exceptions she handles without writing them down, and who approves payments over ₹50k. Write this up as `exceptions.md` in the brain."

**Bad**: "Build an eval set."
**Better**: "Pull 10 historical invoice reconciliations from the company's records. For each, record the correct outcome (matched / mismatch flagged / escalated). Include 3 cases where the correct answer surprised the operator. Save as `evals.json`."

**Bad**: "Define guardrails."
**Better**: "Write `guardrails.md` with three explicit categories: (a) what the agent decides alone (e.g., invoices under ₹10k that match a PO), (b) what it escalates and to whom in what format (e.g., mismatches over ₹50k → Slack DM to founder with PO and invoice attached), (c) what it never does (e.g., never modify a PO, never send a payment instruction without human approval). For each, name the check in the brain that enforces it."

If the user is in interview mode and you don't have their specific service details yet, ask. Better to pause and get one specific name than to ship generic actions.

## Common failure modes to call out

When you see any of these patterns, name them explicitly in the report. These are the recurring ways people convince themselves they have a brain when they don't:

- **Knowledge base disguised as a brain.** Many beautiful docs, zero encoded decisions. The test: if you stripped every "if X then Y" rule from the materials, would anything remain that an agent could *execute*? If yes, it's a KB.
- **Fictional knowledge.** The user wrote the operating model themselves without interviewing the actual operator. The test: ask "who did you interview, and when?" If nobody, the brain is fiction and the agent will act on fiction.
- **Service too broad.** "Automate finance ops" is a programme, not a service. Push to one unit a single human gets paid for today.
- **Easy-mode evals.** Every case in the eval set is the obvious case. The test: ask for the case where the right answer surprised them. If they can't name one, the evals are decorative.
- **Guardrails in the head, not in the brain.** The user can describe what the agent shouldn't do, but the rule isn't in any artifact the agent reads. The test: ask where in the materials the guardrail lives. If "in my head", it isn't a guardrail.
- **Demo masquerading as proof.** A polished walkthrough on synthetic data. The test: ask whether the input came from the real company and whether the operator inspected the output. If either answer is no, it's a demo.

## Tone

Be direct. Users come to this skill because they need an honest read, not encouragement. Praise where things are solid. Name gaps where they exist. The point of the validator is to save them from finding out at the demo that they built enterprise search.

Do not soften ❌s with hedging language. "Knowledge layer is partial — you have the SOP but no interview evidence" is more useful than "Great start! There's room to grow on the knowledge side."

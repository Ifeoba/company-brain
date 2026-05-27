# Validator Rubric

The scoring standard for each of the six company brain dimensions.
Each dimension has three levels: ❌ Missing, ⚠️ Partial, ✅ Solid.

Read this file before scoring any dimension. Do not score from memory.

---

## Dimension 1: Service Definition

**What this dimension tests:** Whether the unit of work is narrow enough, real enough, and paid-for enough to build an executable brain on top of. Broad services produce broad agents that do nothing reliably.

### ❌ Missing
The service is described at programme level ("automate finance", "improve customer experience", "handle support"). There is no named trigger, no specific unit of work, no named deliverable. It is impossible to say when a single unit of work is complete. No human is currently being paid to do this specific thing.

### ⚠️ Partial
A service exists but one of the following is true:
- The trigger is real but the unit of work spans too much ("handle all inbound tickets" vs "draft a first-response to billing dispute tickets")
- The deliverable is named but vague ("a recommendation" rather than "a Slack message to @billing-lead with the draft response attached")
- The scope boundary is missing — it's unclear what this brain does NOT do
- The service is real but seasonal or aspirational, not currently running

### ✅ Solid
The service definition passes all four tests:
1. **Trigger**: A specific, observable event that starts the work (e.g. "a support ticket arrives tagged 'billing dispute'")
2. **Unit**: One discrete piece of work a single human completes in one sitting (e.g. "one ticket")
3. **Deliverable**: A named, inspectable output (e.g. "a draft reply in the ticket thread, ready for human review")
4. **Scope boundary**: At least two things explicitly out of scope, showing the builder has thought about edges

The service is running today. A human is being paid to do it. The agent would replace or augment that human.

---

## Dimension 2: Knowledge Layer

**What this dimension tests:** Whether the operating knowledge has been extracted from where it actually lives — people's heads, Slack threads, email, spreadsheets, tribal memory — not just from official documents. Official SOPs describe the ideal process. The knowledge layer captures how it actually works.

### ❌ Missing
No knowledge extraction has happened. The materials are either: (a) a copy of the official SOP or policy document, (b) a generic description of how this type of work usually goes, or (c) written entirely by the brain builder based on their assumptions. No human who does the work has been interviewed.

### ⚠️ Partial
Some extraction has happened but one or more of these gaps exist:
- Only one source was used (e.g. only the SOP, or only one interview)
- The interview happened but the "unwritten rules" weren't surfaced — only what's already documented was captured
- Special cases for specific customers, partners, or situations are absent
- The knowledge reads like the ideal case with no mention of what goes wrong or what exceptions look like
- The source of each rule isn't annotated (so it can't be verified or updated)

### ✅ Solid
The knowledge layer passes all of these:
- At least one interview with the actual operator (the human who does the work), with a named source and date
- Unwritten rules captured: rules that live in people's heads and aren't in any document, minimum 5
- Special cases captured: at least 2 named customer/partner/vendor exceptions or non-standard situations
- Things that look one way but work differently: at least 1 counterintuitive rule documented
- Every rule has a source annotation so it can be verified or updated when the work changes
- The "what can go wrong" and failure modes are documented, not just the happy path

---

## Dimension 3: Judgment Layer

**What this dimension tests:** Whether the brain encodes how decisions get made — not just what information is available, but what to do with it. A knowledge layer tells you facts. A judgment layer tells you what to do when the facts don't clearly point to an answer.

### ❌ Missing
No decision rules exist. There may be a description of the work but no IF/THEN/ELSE logic. There is no eval set. The materials describe what happens, not how the agent should decide when situations vary.

### ⚠️ Partial
Some decision structure exists but one or more of these gaps remain:
- Decision rules exist but cover only the obvious/routine cases — edge cases and hard cases are absent
- Rules are described in prose rather than encoded in an evaluable format (IF/THEN/ELSE or equivalent)
- An eval set exists but contains fewer than 10 cases, or all cases are "routine" difficulty — no hard cases where the right answer is non-obvious
- The escalation logic is missing or vague ("escalate if unsure" without specifying what "unsure" means, who to escalate to, and in what format)
- No handling documented for missing or ambiguous inputs

### ✅ Solid
The judgment layer passes all of these:
- Decision rules in IF/THEN/ELSE format, covering routine, edge, and hard cases
- At least 3 edge cases explicitly documented with "why this is a trap" explanation
- An eval set with a minimum of 10 cases, including: at least 3 "hard" cases where a smart new hire would likely get it wrong, and at least 1 case documenting the wrong answer and why someone would pick it
- Escalation logic fully specified: trigger condition, who receives it, in what format, what information must be included, and what "approved" looks like
- Handling defined for the most common missing/ambiguous input scenarios

---

## Dimension 4: Skills / Action Layer

**What this dimension tests:** Whether the brain defines what the agent actually *does* — discrete, executable actions with clear inputs and outputs — not just what the agent knows. A brain without skills is a document. Skills are what make it executable.

### ❌ Missing
No skills are defined. The brain may have good knowledge and judgment content, but there is no mapping from decisions to executable actions. There is nothing a developer could pick up and implement. The agent can describe but not do.

### ⚠️ Partial
Skills exist but one or more of these gaps remain:
- Skills are named but not specified — no inputs, outputs, or capabilities listed
- Inputs and outputs are listed but types are missing or vague
- Skills use concrete tool names (e.g. "call the Slack API") instead of abstract capability verbs (e.g. `send_message`) that a runtime can map to real tools
- Not every major step in the workflow has a corresponding skill
- Human approval requirements are undocumented — it's unclear which skills require sign-off before execution
- A skill exists in the workflow description but has no corresponding entry in the skills file

### ✅ Solid
The skills layer passes all of these:
- One skill per major step in the workflow — no step is left unexecutable
- Each skill has: name (snake_case verb), trigger, typed inputs table, typed outputs table, abstract capability verbs, approval required flag
- Capabilities use abstract verbs (`lookup_record`, `send_message`, `write_record`) not tool-specific names — the runtime maps these to real tools at deploy time
- Every skill that requires human approval documents: who approves, in what format, with what information, and what "approved" looks like
- A developer could implement any skill from the definition alone without asking questions

---

## Dimension 5: Guardrails

**What this dimension tests:** Whether the boundaries of agent autonomy are encoded in the brain itself — not in the user's head, not in a separate policy doc, not assumed. Guardrails are what prevents the agent from doing the most damaging thing it could plausibly do.

### ❌ Missing
No guardrails file exists, or it exists but is empty / placeholder. The user can describe what the agent shouldn't do in conversation, but nothing is written in an artifact the agent reads. The agent's boundaries live only in someone's head.

### ⚠️ Partial
Guardrails exist but one or more of these gaps remain:
- Only one or two of the three categories are present (agent decides alone / escalates / never does)
- "Never does" constraints exist but are vague ("never make irreversible changes" without specifying which actions are irreversible in this context)
- "Escalates to human" entries lack specificity: who receives it, what format, what information must be included, or what "approved" looks like
- "Agent decides alone" entries lack conditions — they say what the agent can do but not under what precise circumstances
- At least one skill from the skills file is unaccounted for — it doesn't map to any guardrail category
- Guardrails are written as guidelines ("try to avoid...") rather than hard rules

### ✅ Solid
The guardrails pass all of these:
- All three categories present: agent decides alone, escalates to human, never does
- Every skill in the skills file maps unambiguously to one category — no skill is unaccounted for
- "Agent decides alone" entries have precise conditions, not vague ones ("transactions under £50 with a matching PO on file", not "low-value transactions")
- "Escalates to human" entries specify: trigger condition, who receives escalation, format, what must be included, what "approved" looks like
- "Never does" constraints are hard rules with no exceptions — anything that has an exception belongs in Category 2
- The test: if the agent read only this file, it would know exactly what it cannot do

---

## Dimension 6: Proof

**What this dimension tests:** Whether the brain has been validated on real work — not a demo, not synthetic data, not a walkthrough. Proof is the only way to know if the brain actually works. Everything else is a hypothesis.

### ❌ Missing
No proof log entry exists, or the proof log is a placeholder with no completed entries. The brain has never been run against real input from the actual company. There is no human sign-off from anyone who has verified the output.

### ⚠️ Partial
Some proof exists but one or more of these gaps remain:
- The input was synthetic (fabricated examples, not real company data)
- The agent did not complete the work end-to-end — a human finished it, or it was partially run
- Sign-off came from the same person who built the brain (not an independent reviewer)
- The proof entry describes what happened without specifying the actual input or actual output
- There is only one proof entry and it covered only the routine/easy case — no edge or hard cases verified

### ✅ Solid
The proof log passes all of these:
- At least one entry where the input came from real company data (not fabricated)
- The agent completed the work end-to-end — not a partial run or human-assisted completion
- A named human who did not build the brain reviewed the output and signed off (name, role, date)
- The entry documents actual input, actual steps taken, actual output — not a description of what the agent "would do"
- Verdict is either "Pass" or "Pass with corrections" — and if corrections were needed, they generated a new eval case
- At least one proof run on a non-routine case (edge or hard) — the brain has been stress-tested, not just tested on the easy path

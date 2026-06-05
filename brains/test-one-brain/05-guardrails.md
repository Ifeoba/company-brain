# Guardrails

<!--
INSTRUCTIONS: Encode the boundaries — what the agent decides alone, what it escalates,
and what it never does.

Three categories, all required. Every skill in 04-skills.md must map unambiguously
to one of these three. If you finish this file and there's a skill that doesn't clearly
fit a category, that's a gap — resolve it before putting an agent on this brain.

The test for completeness: if the agent read only this file, would it know what it cannot do?
If not, these aren't real guardrails.
-->

## Category 1: Agent decides alone

<!--
Low-risk, reversible actions the agent takes without waiting for human approval.
Name the conditions precisely — "low-value transactions" is not a condition,
"transactions under £50 with a matching PO on file" is.

If you're unsure whether something belongs here or in Category 2: when in doubt, escalate.
A brain that escalates too much is annoying. A brain that acts too freely is dangerous.
-->

The agent may take the following actions without human approval:

- [Action] — [specific condition under which it applies]
- [Action] — [condition]
- [Action] — [condition]


## Category 2: Escalates to human

<!--
Actions that require human sign-off before proceeding.
For each: what triggers it, who receives the escalation, in what format, and what the
escalation must include so the human can act without asking for more information.
-->

The agent must escalate and wait for approval before:

### [Action or situation]

**Escalate to:** [role or person — be specific, e.g. "@billing-lead on Slack"]  
**Format:** [Slack DM / email / ticket comment / other]  
**The escalation must include:**
- [piece of information the human needs to decide]
- [piece of information]
- [piece of information]

**What "approved" looks like:** [How the agent knows it has approval — e.g. ":white_check_mark: reaction", "reply with 'approved'", "ticket status changed to 'Approved'"]

---

### [Action or situation]

**Escalate to:**  
**Format:**  
**The escalation must include:**
- 
- 

**What "approved" looks like:**


## Category 3: Never does

<!--
Hard constraints. No exceptions. No "unless the situation is really urgent." No overrides.
If you find yourself writing "except when..." — that belongs in Category 2, not here.

These exist to protect the company from catastrophic agent errors. Think: what's the worst
thing this agent could do? What would make the news? Those are your hard constraints.
-->

The agent must never:

- [Hard constraint — specific, not vague]
- [Hard constraint]
- [Hard constraint]

<!--
Every skill in 04-skills.md should now map to one of the three categories above.
If any skill is unaccounted for, this file is incomplete.
-->

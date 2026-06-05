# Decision Rules

<!--
INSTRUCTIONS: Encode how decisions get made — not just the easy cases, but the hard ones,
the edge cases, and the escalations.

The goal: you can pick any test case from 03-evals.json, trace it through the rules here,
and arrive at the correct answer without ambiguity. If that's not true, the rules aren't done.

FORMAT: Use IF / THEN / ELSE structure wherever possible. Numbered rules are easier to
reference from evals and the maintenance log.

Requirements per the Brain Spec:
- IF/THEN/ELSE rules for every non-trivial decision in the workflow
- At least 3 edge cases with explicit handling
- Escalation rules (what, to whom, in what format, with what information)
- Rules for missing or ambiguous information
-->

## Core decision rules

<!-- The main decisions the agent makes during the work. Start with the highest-stakes ones. -->

### Rule 1: [Name this rule]

**IF** [condition]  
**THEN** [action]  
**ELSE** [fallback action]

*Reference: [Which step in 02-how-work-happens.md this covers]*


### Rule 2: [Name this rule]

**IF** [condition]  
**THEN** [action]  
**ELSE** [fallback action]

*Reference:*


<!-- Add more rules as needed. Number them sequentially. -->


## Edge cases

<!-- At least 3. These are the non-obvious cases where the right answer isn't the obvious one.
     A good test: "if a smart new hire encountered this case, which answer would they get wrong?"
     That's an edge case worth writing down. -->

### Edge case 1: [Name]

**Situation:** [Describe the situation]  
**Correct handling:** [What the agent should do]  
**Why this is a trap:** [What the wrong answer looks like and why someone would pick it]


### Edge case 2: [Name]

**Situation:**  
**Correct handling:**  
**Why this is a trap:**


### Edge case 3: [Name]

**Situation:**  
**Correct handling:**  
**Why this is a trap:**


## Escalation rules

<!-- What triggers escalation? To whom? In what format? With what information?
     Be specific. "Escalate if something looks wrong" is not a rule. -->

### Escalation triggers

| Condition | Escalate to | Format | Information to include |
|---|---|---|---|
| [condition] | [role/name] | [Slack DM / email / ticket comment] | [what to attach or summarise] |

### What the escalation must include

<!-- What information must always be present in an escalation for the human to act on it?
     Example: customer name, account status, the specific value that triggered escalation,
     a one-line summary of what the agent was trying to do. -->


## Missing or ambiguous information

<!-- What should the agent do when it doesn't have what it needs?
     Don't leave this as "use best judgment" — encode the judgment. -->

### If [required input] is missing

**Action:** [What the agent does — e.g. "Hold and request the information", "Escalate immediately", "Use [fallback]"]

### If information is contradictory

**Action:** [What the agent does]

### If the situation doesn't match any rule

**Action:** [Default handling — usually escalate, but name exactly how]

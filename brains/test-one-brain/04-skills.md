# Skills

<!--
INSTRUCTIONS: Define what the agent will actually DO — discrete, executable actions with
clear inputs and outputs. Not descriptions of work; contracts for work.

One skill per major step in 02-how-work-happens.md. Every skill must be implementable —
if a developer picked up this file, they could build the skill without asking you anything.

Skills use abstract capability names (send_message, lookup_record, write_file) that the
runtime maps to real tools. This keeps the brain tool-agnostic.

Requirements per the Brain Spec:
- Name, trigger, inputs (with types), outputs (with types), capabilities used
- Whether human approval is required before execution
- At least one skill per major step in the workflow

FORMAT:
## Skill: skill_name
**Trigger:** [what causes this skill to run]
**Inputs:** [list with type and description]
**Outputs:** [list with type and description]
**Capabilities:** [abstract verb names the runtime will map to tools]
**Approval required:** Yes / No
**If approval required:** [who approves, in what format, with what information]

A machine-readable version of these contracts lives in the brain's runtime/skill-contracts.json.
See spec/schemas/skill-contract.schema.json for the schema.
-->

## Skill: [skill_name_in_snake_case]

**Trigger:** [what causes this skill to be invoked — an event, a step completion, a condition]

**Inputs:**
| Parameter | Type | Required | Description |
|---|---|---|---|
| [param_name] | [string / integer / boolean / object] | Yes / No | [what it contains] |

**Outputs:**
| Field | Type | Description |
|---|---|---|
| [field_name] | [type] | [what it contains] |

**Capabilities:** `[abstract_verb]`, `[abstract_verb]`
*(The runtime maps these to real tools — e.g. `send_message` → Slack, `lookup_record` → HubSpot)*

**Approval required:** No

**Notes:** [Anything a developer needs to know — edge cases, known quirks, dependencies on other skills]

---

## Skill: [skill_name_in_snake_case]

**Trigger:**

**Inputs:**
| Parameter | Type | Required | Description |
|---|---|---|---|
|  |  |  |  |

**Outputs:**
| Field | Type | Description |
|---|---|---|
|  |  |  |

**Capabilities:** `[abstract_verb]`

**Approval required:** Yes
**If approved:** [who approves, what format — e.g. "Slack DM to @ops-lead with draft output attached; agent waits for :white_check_mark: reaction before proceeding"]

**Notes:**

---

<!--
Add one skill section per major step in 02-how-work-happens.md.
Name skills as verbs: compile_report, lookup_customer, send_draft, flag_for_review.
-->

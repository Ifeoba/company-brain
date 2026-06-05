# [Service Name] — Company Brain

<!-- Replace this header with the service name. Example: "Billing Support Draft" or "Monthly KPI Compilation" -->

This folder is the operating map for the service: **"[paste the one-sentence service definition from 01-service-definition.md here]"**

An AI agent reads this folder to do the work. A new team member reads it to learn the work. When the work changes, this brain changes.

---

## Owned by

**[Name]** — [Role]  
*Responsible for keeping this brain current. When the work changes, update the brain.*

---

## What's in here

| File | What it contains |
|---|---|
| `01-service-definition.md` | Exactly what this brain is for — trigger, unit of work, deliverable, scope |
| `02-how-work-happens.md` | How the work actually happens, step by step |
| `02-unwritten-rules.md` | Institutional knowledge — the rules that live in people's heads |
| `03-decision-rules.md` | How decisions get made, including edge cases and escalations |
| `03-evals.json` | Test cases with known correct outcomes |
| `04-skills.md` | What the agent does — discrete actions with input/output contracts |
| `05-guardrails.md` | What the agent decides alone, escalates, and never does |
| `06-proof-log.md` | Real units of work the agent completed, with human sign-off |

---

## How to use it

**Agent:** Read this folder before acting. Follow the decision rules in `03-decision-rules.md`. Use the skills defined in `04-skills.md`. Do not cross the lines in `05-guardrails.md`.

**Reviewer:** Check agent outputs against `03-evals.json`. Sign off proof entries in `06-proof-log.md`. Flag any case that isn't covered by the decision rules — it becomes a new rule or eval case.

**Owner:** Update this brain when the work changes. Every new exception is a line in `02-unwritten-rules.md`. Every new decision pattern is a rule in `03-decision-rules.md`. Every agent mistake is a new case in `03-evals.json`.

---

## Status

**Brain Spec version:** 1.0  
**Last updated:** [Date]  
**Validation status:** [Not yet validated / Brain in formation / Brain ready]  

<!-- Run the company-brain-validator to get a formal readiness score. -->

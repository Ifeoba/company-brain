# Owomi Transaction Categorization Review — Company Brain

This folder is the operating map for the service: **"When CategoryEngine returns null or confidence ≤ 0.5 for a transaction, determine the correct subcategory from Owomi's 3-tier taxonomy — auto-committing when user history supports it, or surfacing a Quick Tag card otherwise."**

An AI agent reads this folder to do the work. A new team member reads it to learn the work. When the work changes, this brain changes.

---

## Owned by

**Ifeoluwa Obadiah** — Owomi Engineering Lead  
*Responsible for keeping this brain current. When the categorization logic changes, update the brain.*

---

## What's in here

| File | What it contains |
|---|---|
| `01-service-definition.md` | Exactly what this brain is for — trigger, unit of work, deliverable, scope |
| `02-how-work-happens.md` | How the work actually happens, step by step |
| `02-unwritten-rules.md` | Institutional knowledge — rules that live in people's heads about how Owomi categorization really works |
| `03-decision-rules.md` | How decisions get made, including the confidence threshold logic and escalation rules |
| `03-evals.json` | Test cases with known correct outcomes, drawn from real transaction patterns |
| `04-skills.md` | What the agent does — discrete actions with input/output contracts |
| `05-guardrails.md` | What the agent decides alone, escalates, and never does |
| `06-proof-log.md` | Real transactions the agent categorized, with human sign-off |

---

## How to use it

**Agent:** Read this folder before acting. Follow the decision rules in `03-decision-rules.md`. Use the skills defined in `04-skills.md`. Do not cross the lines in `05-guardrails.md`. The confidence threshold that matters is 0.7 — not 0.5.

**Reviewer:** Check agent outputs against `03-evals.json`. Pay special attention to "transfer" narrations and salary/payroll transactions — these are the most common miscategorization traps. Sign off proof entries in `06-proof-log.md`.

**Owner:** Update this brain when CategoryEngine keyword lists change, when new subcategories are added to `system_subcategories`, or when money plan bucket defaults change. Every miscategorization that reaches a user is a new rule in `02-unwritten-rules.md` and a new case in `03-evals.json`.

---

## Status

**Brain Spec version:** 1.0  
**Last updated:** 2026-05-27  
**Validation status:** Brain in formation

<!-- Run the company-brain-validator to get a formal readiness score. Proof log needs real entries before this brain is production-ready. -->

# Example Brains

This directory contains fully-populated example brains — real-domain brains where every file is complete, not a placeholder.

Example brains serve two purposes:
1. Show new users what "done" actually looks like across all eight files
2. Validate that the spec and templates produce something a real agent can use

## What makes a good example brain

- Every required file is fully populated (no `REPLACE WITH` placeholders remaining)
- The service is a real, narrow unit of work — not a hypothetical
- The unwritten rules came from real interviews, not imagination
- The evals include hard cases with non-obvious correct answers
- At least one proof log entry exists, with a named human sign-off

## Example brains

### owomi-tx-categorization-brain

**Service:** When Owomi's CategoryEngine returns null or confidence ≤ 0.5 for a transaction, determine the correct subcategory from the 3-tier taxonomy — auto-committing when user history supports it, or surfacing a Quick Tag card otherwise.

**Domain:** Owomi — personal finance app for Nigerian users  
**What makes it a good example:** Built around a real production gap (0.5-confidence guesses silently committed without user review). Covers Nigerian bank feed patterns (NIP transfers, Remita, airtime top-ups, salary credits) that a generic classifier would get wrong. Includes 13 eval cases — 6 routine, 4 edge, 3 hard — including the transfer-guard-vs-user-rule conflict (EVAL-013) which is the kind of non-obvious case that breaks naive implementations.

| File | Status |
|---|---|
| `brain-readme.md` | ✅ Complete |
| `01-service-definition.md` | ✅ Complete |
| `02-how-work-happens.md` | ✅ Complete |
| `02-unwritten-rules.md` | ✅ Complete |
| `03-decision-rules.md` | ✅ Complete |
| `03-evals.json` | ✅ Complete — 13 cases |
| `04-skills.md` | ✅ Complete — 6 skills |
| `05-guardrails.md` | ✅ Complete — 9 hard constraints |
| `06-proof-log.md` | ⚠️ Placeholder — needs real agent runs |

**Validator status:** Brain in formation. Proof log entries needed before "Brain ready."

---

## Contributing an example

## Contributing an example

If you've built a brain using this platform and want to contribute it as an example, open a PR with the brain folder. The brain must pass the company-brain-validator at "Brain ready" before it's accepted.

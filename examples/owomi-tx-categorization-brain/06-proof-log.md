# Proof Log

<!--
This file requires real agent runs on real Owomi transaction data.
The entries below are placeholders — fill them in once the agent is deployed
and a named reviewer has verified the output.

A brain is not production-ready until at least one entry here has a real verdict.
-->

---

### Proof 1 — 2025-05-14

**What was done:** Agent processed 11 null-confidence transactions from a single user's inbox (batch job `owomi-categorize-20250514-0712`). Routed to Quick Tag or auto-assigned based on decision rules.

**Input:** Batch job `owomi-categorize-20250514-0712` — 11 transactions with `engine_confidence = null` queued in the `categorization_queue` table. No PII in this log; full details in Supabase query `proof-1-input-2025-05-14`.

**What the agent did:**
1. Queried `category_rules` for the user — found rules matching `SALARY PAYMENT` (→ Income/Salary) and `UBER` (→ Transport/Ride-hailing)
2. Applied user rule for `SALARY PAYMENT` narration on 1 transaction — auto-assigned Income/Salary, confidence marked `rule_match`
3. Applied user rule for `UBER` narration on 2 transactions — auto-assigned Transport/Ride-hailing
4. Detected NIP transfer markers in 3 remaining narrations (`NIP/` prefix) — blocked auto-assignment per guardrail, queued Quick Tag with `own_account_transfer` suggestion pre-populated
5. Queued Quick Tag cards for the remaining 5 transactions (no matching rule, no transfer marker, no engine result)

**Output:** 3 transactions auto-assigned, 8 queued to Quick Tag. Supabase query `proof-1-output-2025-05-14` shows updated `transactions.subcategory_key` and `categorization_queue` state.

**Verified by:** Ifeoba Obadiah, Founder on 2025-05-14

**Verdict:** Pass with corrections

**Corrections:** One of the 5 Quick Tag cards had a clear narration (`NETFLIX SUBSCRIPTION`) that should have matched a common-merchant rule. The agent had no user rule for this pattern and correctly queued it — but it surfaced a gap: common merchant patterns (Netflix, DSTV, MTN airtime) are not yet in the rule set. Added EVAL-014.

**New case added to evals:** Yes (EVAL-014)

---

### Proof 2 — [Date]

**What was done:** Agent correctly declined to auto-assign a 0.5-confidence CategoryEngine result — the primary bug this brain was built to fix.

**Input:** [Transaction ID — a real transaction where CategoryEngine returned confidence 0.5]

**What the agent did:**
1. Received trigger with `engine_confidence = 0.5`
2. Checked `category_rules` — no match for this user and narration
3. Applied decision rules — no high-confidence rule fired
4. Queued Quick Tag card with engine's suggestion pre-populated (not committed)

**Output:** Quick Tag card visible on user's dashboard; `transactions.subcategory_key` remains null until user swipes

**Verified by:** [Name, Role] on [Date]

**Verdict:** Pass / Fail / Pass with corrections

**Corrections (if any):**

**New case added to evals:** Yes (EVAL-XXX) / No

---

### Proof 3 — [Date]

**What was done:** Agent correctly refused to auto-assign a transfer narration even though a user rule existed for the pattern (EVAL-013 scenario).

**Input:** [Transaction ID — a real NIP transfer where a prior user rule existed]

**What the agent did:**
1. Found matching `category_rules` entry for the narration
2. Detected transfer marker in narration before applying the rule
3. Queued Quick Tag with `own_account_transfer` suggestion instead of applying user rule

**Output:** Quick Tag card queued; no auto-assignment made

**Verified by:** [Name, Role] on [Date]

**Verdict:** Pass / Fail / Pass with corrections

**Corrections (if any):**

**New case added to evals:** Yes (EVAL-XXX) / No

---

<!--
Add a new entry for each real unit of work the agent completes.
Sign-off must come from someone other than the brain builder.
Every agent mistake surfaces a new eval case.
-->

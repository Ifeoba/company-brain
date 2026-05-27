# Proof Log

<!--
This file requires real agent runs on real Owomi transaction data.
The entries below are placeholders — fill them in once the agent is deployed
and a named reviewer has verified the output.

A brain is not production-ready until at least one entry here has a real verdict.
-->

---

### Proof 1 — [Date]

**What was done:** Agent processed a batch of null-confidence transactions from a real user's inbox and correctly routed them to Quick Tag or auto-assigned via user rules.

**Input:** [Real transaction IDs from Supabase — do not paste PII here; reference the batch job log ID]

**What the agent did:**
1. Queried `category_rules` for the user — found 3 matching rules for narration patterns in the batch
2. Applied decision rules to the remaining transactions — flagged 2 transfer narrations, auto-assigned 1 payroll credit
3. Queued Quick Tag cards for the 4 transactions with no confident match

**Output:** [Link to Supabase query showing updated `transactions` rows and Quick Tag queue state]

**Verified by:** [Name, Role] on [Date]

**Verdict:** Pass / Fail / Pass with corrections

**Corrections (if any):**

**New case added to evals:** Yes (EVAL-XXX) / No

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

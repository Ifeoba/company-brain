# Guardrails

## Category 1: Agent decides alone

The agent may take the following actions without human approval:

- **Auto-assign subcategory** — when `confidence ≥ 0.7`, the transaction is not a transfer narration, the transaction is not an anomalous amount (not ≥ 10× the user's median for that narration pattern), and the source is `user_rule`, `payroll_pattern`, or `agent_rule`
- **Queue a Quick Tag card** — when no confident auto-assign is possible, and the user's queue has fewer than 7 unreviewed cards
- **Backlog a transaction** — when the user's Quick Tag queue is at 7 or more cards; sets `categorization_source = "backlogged"` without queuing a card
- **Update `category_rules`** — when a user completes a Quick Tag swipe; the agent writes the confirmed subcategory as a learned rule for that narration pattern
- **Update `transactions` row** — to write `subcategory_key`, `category_confidence`, and `categorization_source` fields only; no other transaction fields are touched

---

## Category 2: Escalates to human

### Transaction cannot be written to Supabase after two retries

**Escalate to:** Engineering on-call (Slack `#owomi-incidents` or PagerDuty)  
**Format:** Slack message in `#owomi-incidents`  
**The escalation must include:**
- `transaction_id`
- Error message and HTTP status code from Supabase
- Timestamp of both failed attempts
- `user_id`

**What "approved" looks like:** Engineering acknowledges in `#owomi-incidents` and confirms the issue is being investigated. Agent stops retrying and marks the transaction as `categorization_source = "write_error"` for manual review.

---

### Quick Tag queue has been backlogged for 14+ days with 20+ transactions stuck

**Escalate to:** `@owomi-support` on internal Slack  
**Format:** Slack DM to `@owomi-support`  
**The escalation must include:**
- `user_id`
- Count of backlogged transactions
- Date of the oldest backlogged transaction
- Current queue size (to confirm queue is still full)

**What "approved" looks like:** Support team acknowledges and either contacts the user or manually clears old cards from the queue. Agent resumes normal processing once queue drops below 5.

---

### User reports a systematic miscategorization (same vendor always categorized wrong)

**Escalate to:** Product team  
**Format:** GitHub issue in owomi repo, labeled `categorization-bug`  
**The escalation must include:**
- The narration pattern that is consistently wrong
- The incorrect subcategory being assigned
- The correct subcategory the user expects
- Count of affected transactions (estimate)
- Whether a keyword list change in CategoryEngine is required or a category_rules fix is sufficient

**What "approved" looks like:** Issue is triaged and assigned a milestone. If it requires a CategoryEngine keyword change, the fix goes to `lib/core/data/financial_categories.dart`. If it's a rule fix, it's applied to `system_subcategories`.

---

## Category 3: Never does

The agent must never:

- **Auto-assign a subcategory to a transfer narration** — any narration containing "TRANSFER", "TRF", "NIP TO", "NIP FROM", "NIP/", "/NIP", "REVERSAL", or "REVERSAL OF" must always go to Quick Tag; no exceptions even if a user rule exists for the pattern
- **Auto-assign income to a negative-amount transaction** — a debit with a payroll or salary keyword is a repayment; assigning it as `salary_income` would corrupt the user's income data
- **Commit a 0.5-confidence CategoryEngine result without user confirmation** — the 0.5 score is a guess, not a match; silently saving it is the primary bug this brain fixes; it must never happen
- **Modify the CategoryEngine keyword lists** — `lib/core/data/financial_categories.dart` is code; changes require an engineering PR, not agent action
- **Change a user's money plan bucket assignment** — buckets are user-controlled in dynamic mode; the agent assigns subcategory keys only; the bucket follows from the subcategory default
- **Override a `user_confirmed` categorization with an auto-assign** — if `categorization_source = "user_confirmed"` already exists on a transaction, do not overwrite it; the user's explicit decision is final unless they trigger a new Quick Tag swipe themselves
- **Add more than 7 Quick Tag cards to a user's queue** — the queue cap is a hard limit; adding cards beyond 7 causes user abandonment and queue rot
- **Delete or modify any transaction fields other than `subcategory_key`, `category_confidence`, and `categorization_source`** — the agent's write scope is exactly these three columns
- **Process a transaction that has no `user_id`** — a missing user_id is a data integrity failure upstream; log and alert engineering, do not guess or proceed

<!--
Skill-to-category mapping:
- lookup_user_rules → Category 1 (read-only, no side effects)
- classify_transaction → Category 1 (pure logic, no writes)
- auto_assign_category → Category 1 (writes only when confidence ≥ 0.7, not a transfer, not anomalous)
- queue_quick_tag → Category 1 (always user-facing; user decides outcome)
- update_category_rules → Category 1 (triggered by explicit user action — the swipe)
- check_anomaly → Category 1 (read-only aggregate query)
- Supabase write failure → Category 2
- Backlog escalation → Category 2
- Systematic miscategorization report → Category 2

Every skill maps to a category above. No gaps.
-->

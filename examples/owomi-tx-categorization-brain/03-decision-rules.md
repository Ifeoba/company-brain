# Decision Rules

<!-- IF/THEN/ELSE format. Apply rules in the order listed — first match wins. -->

---

## Rule 1: User has a learned rule for this narration

**IF** `category_rules` contains a row for this `user_id` where `narration_pattern` is a case-insensitive substring of the transaction narration  
**THEN** use `category_rules.subcategory_key` as the assignment; set `confidence = 0.9`; set `source = "user_rule"`; auto-commit without queueing Quick Tag  
**ELSE** continue to Rule 2

*Why this rule is first: User's explicit past decision is more reliable than any heuristic.*

---

## Rule 2: Narration contains a transfer marker

**IF** narration contains any of: "TRANSFER", " TRF ", "NIP TO", "NIP FROM", "NIP/", "/NIP", "REVERSAL", "REVERSAL OF"  
**THEN** do NOT assign a spending subcategory; queue Quick Tag card with `suggested_subcategory = "own_account_transfer"`  
**ELSE** continue to Rule 3

*Why: Transfer narrations are inter-account moves, not purchases. Miscategorizing them corrupts spending reports.*

---

## Rule 3: Narration contains a payroll marker AND amount is positive (credit)

**IF** narration contains any of: "SALARY", "PAYROLL", "WAGES", "STAFF PAY", "REMUNERATION"  
AND `amount > 0`  
**THEN** assign `subcategory_key = "salary_income"`; set `confidence = 0.85`; set `source = "payroll_pattern"`; auto-commit  
**ELSE IF** narration contains payroll marker AND `amount < 0`  
**THEN** this is a repayment — queue Quick Tag with no pre-populated subcategory  
**ELSE** continue to Rule 4

*Why: Negative payroll-named transactions are loan/advance repayments, not salary credits.*

---

## Rule 4: Narration contains a Remita marker

**IF** narration contains "REMITA"  
**THEN** assign `subcategory_key = "government_payment"`; set `confidence = 0.75`; set `source = "agent_rule"`; auto-commit  
**ELSE** continue to Rule 5

---

## Rule 5: Narration contains telecom airtime/data markers

**IF** narration contains any of: "AIRTIME", "DATA BUNDLE", "DATA SUB", "VTU"  
AND narration contains any of: "MTN", "AIRTEL", "GLO", "9MOBILE", "ETISALAT"  
**THEN** assign `subcategory_key = "airtime_and_data"`; set `confidence = 0.85`; set `source = "agent_rule"`; auto-commit  
**ELSE** continue to Rule 6

---

## Rule 6: CategoryEngine returned a subcategory with confidence 0.7 or higher

**IF** the original CategoryEngine result had `confidence >= 0.7` (this transaction was queued despite meeting the 0.7 threshold — e.g. re-processing a transaction)  
**THEN** accept the CategoryEngine result; auto-commit with original confidence  
**ELSE** continue to Rule 7

*Note: This rule covers edge cases where transactions are re-processed. In normal flow, confidence ≤ 0.5 is the entry condition, so this rule rarely fires.*

---

## Rule 7: Amount is positive and no income marker matched

**IF** `amount > 0` AND no prior rule matched  
**THEN** queue Quick Tag with `suggested_subcategory = null` and a note: "We couldn't identify this credit — is it income, a refund, or something else?"  
**ELSE** continue to Rule 8

*Why: Unclassified credits are especially risky to auto-assign — they affect income vs. expense totals.*

---

## Rule 8: No rule matched — queue Quick Tag with best-guess

**IF** no prior rule matched  
**THEN** take CategoryEngine's result (even if confidence ≤ 0.5) as a suggested subcategory for the Quick Tag card (do not auto-commit); queue Quick Tag card with the CategoryEngine result pre-populated as a suggestion only  

*Why: The user gets a head start on the swipe with whatever the engine guessed, but does not have the guess silently committed.*

---

## Edge cases

### Edge case 1: Narration is empty string

**Situation:** Bank feed returned a transaction with blank narration.  
**Rule:** Queue Quick Tag with no pre-populated suggestion and label "Unknown transaction — please identify."  
**Why this is a trap:** Empty string technically passes substring checks (any pattern matches empty); make sure all pattern checks explicitly guard against `len(narration) == 0`.

---

### Edge case 2: Vendor name matches multiple subcategories

**Situation:** "AMAZON" could be Shopping (Online Shopping), Business (Software/SaaS), or Entertainment (Prime Video).  
**Rule:** Amazon alone is insufficient — check amount range: < ₦3,000 → Entertainment; ₦3,000–₦50,000 → Shopping; > ₦50,000 → queue Quick Tag.  
**Why this is a trap:** A naive keyword match always assigns the first subcategory for "AMAZON" in the taxonomy, which is Shopping — but ₦600 Amazon charges are almost always Prime Video or Kindle.

---

### Edge case 3: Transaction from a month ago is re-categorized

**Situation:** A historical transaction is being re-processed (user manually triggered re-categorization).  
**Rule:** Apply all rules above as normal. Do not check `transaction_date` for staleness. Overwrite existing `subcategory_key` only if the new confidence is higher than the existing one, OR if source is `"user_confirmed"` (user triggered).  
**Why this is a trap:** Auto-overwriting a user-confirmed historical categorization is a regression — the user already told us the right answer.

---

### Edge case 4: Two transactions with identical narrations but different amounts

**Situation:** User has a category_rule for "SHOPRITE LG" → Groceries, but a new transaction "SHOPRITE LG" is ₦450,000 (far above normal grocery spend).  
**Rule:** Apply the user rule (Rule 1), but flag the transaction for review if the amount exceeds 10× the median amount for that narration pattern in the user's transaction history. Queue a Quick Tag note: "This looks larger than usual — is it still Groceries?"  
**Why: User rules are trusted, but anomalous amounts may indicate a different merchant or a data error.*

---

## Escalation table

| Situation | Escalate to | Format | Information to include |
|---|---|---|---|
| Quick Tag queue has been backlogged (>14 days, >20 transactions) | @owomi-support on internal Slack | Slack message | User ID, count of backlogged transactions, oldest backlog date |
| A transaction keeps failing to save (Supabase write error) | Engineering on-call | PagerDuty or Slack #incidents | transaction_id, error message, timestamp |
| A user reports a systematic miscategorization (same vendor always wrong) | Product team | GitHub issue in owomi repo | Narration pattern, correct subcategory, count of affected transactions |

---

## Handling missing or ambiguous information

| Missing information | What to do |
|---|---|
| `narration` is null or empty | Queue Quick Tag; do not error |
| `user_id` is missing from transaction row | Do not process; log error; alert engineering — this indicates a data integrity issue upstream |
| `system_subcategories` table is unreachable | Use the hardcoded fallback taxonomy in `lib/core/data/financial_categories.dart`; do not block processing |
| CategoryEngine returns a subcategoryKey not present in `system_subcategories` | Treat as null; do not use a stale/deleted subcategory key |

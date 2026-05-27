# How the Work Happens

## Trigger

A transaction lands in the review queue when:
- CategoryEngine returns `subcategoryKey == null`, OR
- CategoryEngine returns a result but `confidence ≤ 0.5`

Both cases are treated identically: the engine's output is discarded and the review process begins from scratch.

---

## Inputs

| Input | Source | Notes |
|---|---|---|
| `transaction_id` | Supabase `transactions` table | UUID of the transaction to classify |
| `narration` | `transactions.narration` | Raw string from bank feed — e.g. "POS PURCHASE SHOPRITE LG" |
| `amount` | `transactions.amount` | Negative = debit, positive = credit |
| `transaction_date` | `transactions.created_at` | Used to check for payroll timing patterns |
| `user_id` | `transactions.user_id` | Used to look up user's category_rules |

---

## Steps

### Step 1 — Check user's learned rules (category_rules)

Query `category_rules` for the `user_id` where the narration pattern matches the incoming transaction narration. Match is a case-insensitive substring match on `category_rules.narration_pattern`.

**If a matching rule exists:**
- Use the rule's `subcategory_key`
- Set confidence to 0.9 (user-confirmed rule is the strongest signal)
- Skip to Step 4 (auto-assign)

**If no matching rule:** Continue to Step 2.

---

### Step 2 — Apply decision rules to classify from narration

Apply the rules in `03-decision-rules.md` in order:

1. Check for transfer markers in narration ("TRANSFER", "TRF", "NIP", "REVERSAL") — if present, do not assign a spending subcategory; skip to Step 3 (queue Quick Tag with "Transfer" pre-populated)
2. Check for payroll markers ("SALARY", "PAYROLL", "WAGES", "REMITA") — if present and amount is positive, assign to subcategory `salary_income` with confidence 0.85; skip to Step 4
3. Check for known vendor patterns against `system_subcategories` narration hints
4. Apply top-level category heuristics from narration keywords

**If classification confidence ≥ 0.7:** Continue to Step 4 (auto-assign).  
**If classification confidence < 0.7 or no classification found:** Continue to Step 3 (queue Quick Tag).

---

### Step 3 — Queue a Quick Tag card

Prepare a Quick Tag card with:
- Transaction narration and amount
- Best-guess subcategory pre-populated (if any was found in Step 2, even at low confidence)
- The three most plausible alternative subcategories as swipe options

Write the card to the Quick Tag queue. The card surfaces on the user's dashboard.

**End of agent's work for this transaction.** The user's swipe triggers `update_category_rules` (Step 5).

---

### Step 4 — Auto-assign subcategory

Update `transactions` row:
- `subcategory_key` = determined subcategory
- `category_confidence` = confidence score
- `categorization_source` = `"user_rule"` | `"agent_rule"` | `"payroll_pattern"`

Write to Supabase. No user interaction required.

---

### Step 5 — Update category_rules (triggered by user Quick Tag swipe)

When the user confirms or changes the subcategory via Quick Tag:
- Insert or update a row in `category_rules`:
  - `user_id`, `narration_pattern` (the transaction narration), `subcategory_key` (what user picked)
- Update the transaction row with the user-confirmed subcategory and `confidence = 1.0`
- Set `categorization_source = "user_confirmed"`

---

## Completion

The unit of work is complete when:
- The transaction has a `subcategory_key` with `confidence ≥ 0.7` (auto-assign path), OR
- A Quick Tag card has been queued and is visible to the user (Quick Tag path)

A transaction is **not** complete if it remains with `confidence ≤ 0.5` and no Quick Tag card has been queued — that is the current bug this brain fixes.

---

## Common variations

| Variation | How it's handled |
|---|---|
| Multiple transactions with same narration pattern arrive in batch | Process each one; the first auto-assign also creates a category_rule, so subsequent identical narrations resolve via Step 1 |
| User has Quick Tag queue already at 7+ items | Do not add more cards — log the transaction as `backlogged` and retry after queue drains below 5 |
| Narration is empty string | Treat as null category; queue Quick Tag card with no pre-populated suggestion |
| Amount is positive but narration looks like a purchase | Positive amounts can be refunds; do not override to income — queue Quick Tag |

---

## What can go wrong

| Failure | Symptom | Recovery |
|---|---|---|
| `category_rules` query returns stale match for a changed vendor | Transaction auto-assigned to wrong subcategory | User can re-tag via Quick Tag; the new tag overwrites the rule |
| Payroll marker appears in non-salary transfer (e.g. "SALARY ADVANCE REPAYMENT") | Incorrectly assigned to `salary_income` | Step 2 order check: if amount is negative, do not apply payroll rule |
| Quick Tag queue never shown to user (mobile notification off) | Transactions pile up uncategorized | Queue backlog alert fires after 14 days; owner reviews `backlogged` transactions manually |

---

## Source

*Workflow documented from codebase analysis of `lib/core/data/financial_categories.dart` and `category_rules` Supabase schema. Confirmed with Ifeoluwa Obadiah, 2026-05.*

# Unwritten Rules

<!-- These are the rules that live in people's heads — not in any doc, not in the code.
     Every rule has a source so it can be verified or updated. -->

---

## Rules not written anywhere else

**Rule 1: Confidence 0.5 is a guess, not a match. Treat it the same as null.**

CategoryEngine returns 0.5 when the keyword-to-narration ratio is below 30%. This is the lowest possible score — it means the engine found a keyword but it was a weak hit. The code does not currently block a 0.5-confidence category from being saved, but a 0.5 categorization is no better than random. Any brain operating on Owomi data must treat `confidence ≤ 0.5` as "uncategorized."

*Source: Ifeoluwa Obadiah, 2026-05 — codebase review of CategoryEngine confidence logic*

---

**Rule 2: "Transfer" narrations are almost always between the user's own accounts.**

Narrations containing "TRANSFER", "TRF", "NIP TO", "NIP FROM", or "REVERSAL" are almost never purchases. They are account-to-account moves. Assigning them to a spending subcategory (e.g. Food, Transport) would corrupt the user's spending reports. Always queue Quick Tag for explicit user confirmation before assigning a spending subcategory to a transfer narration.

*Source: Ifeoluwa Obadiah, 2026-05 — observed as top source of user complaints in categorization*

---

**Rule 3: The Quick Tag queue breaks down above 7 unreviewed cards.**

User research showed that when the Quick Tag queue has more than 7 cards, users stop swiping entirely. Cards pile up indefinitely. Do not add cards to a queue that already has 7 or more unreviewed items — log the transaction as `backlogged` instead and retry when the queue drains.

*Source: Ifeoluwa Obadiah, 2026-05 — product observation, not currently enforced in code*

---

**Rule 4: Payroll markers in negative-amount transactions are repayments, not income.**

"SALARY ADVANCE REPAYMENT", "LOAN REPAYMENT - PAYROLL", and similar strings contain salary/payroll keywords but represent money going out (debit). The payroll auto-assign rule applies only to positive amounts (credits). A negative-amount transaction with payroll keywords is a loan repayment and should be queued for user confirmation.

*Source: Ifeoluwa Obadiah, 2026-05 — real case from early Owomi testing*

---

**Rule 5: category_rules learned from Quick Tag always override CategoryEngine output.**

CategoryEngine is the default; user-learned rules are the override. If a user has previously tagged a narration pattern, that tag wins — even if CategoryEngine would assign a different (and technically higher-confidence) result. The user's explicit preference takes precedence over the engine's keyword match.

*Source: Ifeoluwa Obadiah, 2026-05 — product intent; not all code paths currently enforce this*

---

**Rule 6: An empty narration field is not an error — it's a data quality problem.**

Some bank feeds return blank narrations for certain transaction types (often direct debits). Do not treat an empty narration as an error to throw. Treat it as a null-category transaction and queue a Quick Tag card with no pre-populated suggestion. The user is the only one who can identify what a blank-narration debit is.

*Source: Ifeoluwa Obadiah, 2026-05*

---

## Special cases for specific patterns

**Special case: Remita transactions**

Transactions with "REMITA" in the narration are almost always government payments (taxes, levies, fines) or institutional subscriptions. Do not assign to generic "Online Shopping" or "Services" — use `government_payment` subcategory. Remita is a payment infrastructure company; the narration alone won't tell you what was paid, but the subcategory should reflect the infrastructure, not the product.

*Source: Ifeoluwa Obadiah, 2026-05*

---

**Special case: "AIRTIME" and "DATA" narrations from telecoms**

MTN, Airtel, Glo, 9mobile airtime/data purchases show up with narrations like "AIRTIME TOP UP MTN" or "DATA BUNDLE AIRTEL". These should map to `airtime_and_data` subcategory under Utilities, not to "Phone" or "Entertainment." The bucket assignment is `live` by default.

*Source: Ifeoluwa Obadiah, 2026-05*

---

## Things that look one way but work differently

**The money plan bucket is not assigned by this brain.**

It looks like subcategory assignment and bucket assignment are the same step — they happen together in the UI. But the bucket comes from the subcategory's default in `system_subcategories`, not from this agent. The agent assigns the subcategory key; the bucket follows automatically. The agent never sets the bucket directly. If a user has customized their bucket for a subcategory in dynamic mode, that customization is preserved.

*Source: Ifeoluwa Obadiah, 2026-05*

---

**CategoryEngine confidence is a ratio, not a probability.**

The confidence score (0.5, 0.7, 0.9) does not mean "50% probability this is correct." It means: the ratio of matched keyword length to total narration length exceeded certain thresholds (>50% → 0.9, >30% → 0.7, else → 0.5). A 0.9 score doesn't guarantee correctness — it means the keyword dominated the narration string. "SHOPRITE LAGOSNG" with a "grocery" keyword match returns 0.9 because "SHOPRITE" fills most of the string. This is a heuristic, not a trained model score.

*Source: Ifeoluwa Obadiah, 2026-05 — CategoryEngine implementation in lib/core/data/financial_categories.dart*

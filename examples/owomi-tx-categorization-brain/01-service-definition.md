# Service Definition

## Service

**One sentence:** When Owomi's CategoryEngine processes a transaction and returns `null` (no keyword match) or `confidence ≤ 0.5` (low-confidence guess), determine the correct subcategory from the 3-tier taxonomy using user history and narration patterns, then either auto-commit the assignment or queue a Quick Tag card for user confirmation.

---

## Who does this today

**CategoryEngine** (`lib/core/data/financial_categories.dart`) attempts the first classification pass. When it returns null or a low-confidence result, no one currently reviews or corrects it — the 0.5 confidence guess silently goes through as if it were correct. This brain closes that gap.

*Source: Ifeoluwa Obadiah, 2026-05*

---

## Trigger

A transaction is processed by CategoryEngine and the result meets one of:
- `subcategoryKey == null` — no keyword match found
- `confidence ≤ 0.5` — keyword ratio below 30% of narration length, meaning it's a guess

---

## Unit of work

One transaction record from the `transactions` Supabase table.

---

## Deliverable

One of two outcomes per transaction:
1. **Auto-assignment:** Subcategory committed to `transactions.subcategory_key` and `transactions.category_confidence` updated to the new confidence score (≥ 0.7)
2. **Quick Tag card queued:** Transaction added to the Quick Tag queue with a suggested subcategory pre-populated, awaiting user swipe to confirm or change

---

## Systems touched

| System | How it's used |
|---|---|
| CategoryEngine (`lib/core/data/financial_categories.dart`) | Original classification source — provides `subcategoryKey` and confidence |
| Supabase `transactions` table | Source of transaction data; destination for subcategory assignment |
| Supabase `category_rules` table | User-learned rules from Quick Tag history — checked before any other lookup |
| Supabase `system_subcategories` table | Admin-maintained list of valid subcategories across the 3-tier taxonomy |
| Quick Tag UI | Swipeable card UI on dashboard — receives queued cards when agent cannot auto-assign |

---

## Taxonomy structure

Three-tier hierarchy:
- **Tier 1 (Top-level):** e.g. Food & Dining, Transport, Shopping, Income
- **Tier 2 (Subcategory):** e.g. Groceries, Ride-hailing, Online Shopping
- **Tier 3 (Money plan bucket):** give / save / live / enjoy / commit — user can override in dynamic mode

The agent assigns at Tier 2 (subcategory). Tier 3 bucket is derived automatically from the subcategory default unless the user has overridden it.

---

## Out of scope

- **Modifying CategoryEngine keyword lists** — admin-only, requires code change in `lib/core/data/financial_categories.dart`
- **Changing money plan bucket assignments** — user-controlled; the agent does not override a user's existing bucket preference
- **Creating new top-level categories** — structural taxonomy changes require engineering review
- **Categorizing transactions that CategoryEngine already assigned with confidence > 0.5** — those are not in scope; this brain only handles the null/low-confidence tail
- **Bulk re-categorization of historical transactions** — one transaction at a time only

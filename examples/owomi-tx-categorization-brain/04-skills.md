# Skills

## Skill: lookup_user_rules

**Trigger:** Start of every transaction review — runs before any other classification attempt

**Inputs:**
| Parameter | Type | Required | Description |
|---|---|---|---|
| `user_id` | string | Yes | Owomi user UUID — used to scope the query to this user's learned rules |
| `narration` | string | Yes | Raw transaction narration string from the bank feed |

**Outputs:**
| Field | Type | Description |
|---|---|---|
| `matched` | boolean | Whether a matching rule was found |
| `subcategory_key` | string \| null | The subcategory from the matched rule, or null if no match |
| `confidence` | float | 0.9 if matched, null if not matched |
| `source` | string | `"user_rule"` if matched, null if not matched |

**Capabilities:** `lookup_record`  
*(Runtime maps `lookup_record` → Supabase `category_rules` table query)*

**Approval required:** No

**Notes:** Match is a case-insensitive substring match: `narration.lower().contains(rule.narration_pattern.lower())`. If multiple rules match (e.g. both "SHOPRITE" and "LAGOS" are separate patterns), use the most specific (longest) matching pattern.

---

## Skill: classify_transaction

**Trigger:** After `lookup_user_rules` returns `matched = false`

**Inputs:**
| Parameter | Type | Required | Description |
|---|---|---|---|
| `narration` | string | Yes | Raw transaction narration |
| `amount` | float | Yes | Transaction amount — negative = debit, positive = credit |
| `engine_subcategory_key` | string \| null | No | The subcategoryKey returned by CategoryEngine (may be null) |
| `engine_confidence` | float | No | CategoryEngine confidence score (0.5, 0.7, or 0.9) |

**Outputs:**
| Field | Type | Description |
|---|---|---|
| `subcategory_key` | string \| null | Determined subcategory key, or null if no rule matched confidently |
| `confidence` | float | Confidence score of the classification (0.5–0.9) |
| `source` | string | `"payroll_pattern"` \| `"agent_rule"` \| `"engine_fallback"` \| `"no_match"` |
| `suggested_only` | boolean | True if the subcategory is a suggestion for Quick Tag, not a commit |

**Capabilities:** `lookup_record`, `read_file`  
*(Runtime maps `lookup_record` → Supabase `system_subcategories`; `read_file` → hardcoded fallback taxonomy)*

**Approval required:** No

**Notes:** Apply decision rules from `03-decision-rules.md` in order (Rules 2–8). Rules 2–6 can produce a confident auto-assign result (confidence ≥ 0.7). Rules 7–8 always produce `suggested_only = true`. Set `suggested_only = false` only when `confidence ≥ 0.7` and the transaction is not a transfer or anomalous-amount case.

---

## Skill: auto_assign_category

**Trigger:** After `classify_transaction` returns `confidence ≥ 0.7` AND `suggested_only = false`

**Inputs:**
| Parameter | Type | Required | Description |
|---|---|---|---|
| `transaction_id` | string | Yes | UUID of the transaction row in Supabase |
| `subcategory_key` | string | Yes | Subcategory to commit |
| `confidence` | float | Yes | Confidence score to write |
| `source` | string | Yes | Categorization source label |

**Outputs:**
| Field | Type | Description |
|---|---|---|
| `success` | boolean | Whether the Supabase write succeeded |
| `error` | string \| null | Error message if write failed |

**Capabilities:** `write_record`  
*(Runtime maps `write_record` → Supabase `transactions` table UPDATE)*

**Approval required:** No

**Notes:** Write three fields to the `transactions` row: `subcategory_key`, `category_confidence`, `categorization_source`. Do not touch any other fields. If write fails, log the error and surface to engineering via `send_alert` — do not silently swallow write failures.

---

## Skill: queue_quick_tag

**Trigger:** After `classify_transaction` returns `suggested_only = true` OR after Quick Tag queue size check passes (queue < 7)

**Inputs:**
| Parameter | Type | Required | Description |
|---|---|---|---|
| `transaction_id` | string | Yes | UUID of the transaction |
| `narration` | string | Yes | Transaction narration to display on the card |
| `amount` | float | Yes | Transaction amount to display |
| `suggested_subcategory_key` | string \| null | No | Pre-populated suggestion for the card (can be null) |
| `card_note` | string \| null | No | Optional note shown on the card (e.g. "This looks larger than usual") |
| `user_id` | string | Yes | User whose Quick Tag queue receives the card |

**Outputs:**
| Field | Type | Description |
|---|---|---|
| `queued` | boolean | Whether the card was added to the queue |
| `queue_size_after` | integer | New queue size after adding this card |
| `backlogged` | boolean | True if card was not queued because queue was already at capacity |

**Capabilities:** `write_record`, `read_record`  
*(Runtime maps `write_record` → Quick Tag queue table; `read_record` → queue size check)*

**Approval required:** No

**Notes:** Before writing, read the current queue size. If queue size ≥ 7, do NOT write the card — set `backlogged = true` on the transaction row instead (`categorization_source = "backlogged"`). A background job should retry backlogged transactions when queue drains below 5.

---

## Skill: update_category_rules

**Trigger:** User completes a Quick Tag swipe (confirms or changes a subcategory)

**Inputs:**
| Parameter | Type | Required | Description |
|---|---|---|---|
| `user_id` | string | Yes | Owomi user UUID |
| `narration` | string | Yes | The transaction narration — becomes the narration_pattern for the new rule |
| `confirmed_subcategory_key` | string | Yes | The subcategory the user selected |
| `transaction_id` | string | Yes | Transaction to update with the confirmed categorization |

**Outputs:**
| Field | Type | Description |
|---|---|---|
| `rule_created` | boolean | Whether a new category_rule row was inserted |
| `rule_updated` | boolean | Whether an existing category_rule row was updated |
| `transaction_updated` | boolean | Whether the transaction row was updated |

**Capabilities:** `write_record`, `upsert_record`  
*(Runtime maps `upsert_record` → Supabase `category_rules` INSERT OR UPDATE; `write_record` → `transactions` UPDATE)*

**Approval required:** No

**Notes:** Upsert into `category_rules` on `(user_id, narration_pattern)` — if the pattern already exists for this user, update `subcategory_key` to the new confirmed value. Update `transactions` row: set `subcategory_key = confirmed_subcategory_key`, `category_confidence = 1.0`, `categorization_source = "user_confirmed"`. This is the learning loop — every Quick Tag swipe makes future auto-assignments more accurate.

---

## Skill: check_anomaly

**Trigger:** After `lookup_user_rules` returns a match — run before auto-assigning if a rule match was found

**Inputs:**
| Parameter | Type | Required | Description |
|---|---|---|---|
| `user_id` | string | Yes | Owomi user UUID |
| `narration_pattern` | string | Yes | The matching rule's narration pattern |
| `amount` | float | Yes | Current transaction amount |

**Outputs:**
| Field | Type | Description |
|---|---|---|
| `is_anomalous` | boolean | Whether this amount is ≥ 10× the user's median for this pattern |
| `median_amount` | float \| null | Median transaction amount for this pattern in user's history |
| `anomaly_note` | string \| null | Pre-written card note if anomalous |

**Capabilities:** `aggregate_records`  
*(Runtime maps `aggregate_records` → Supabase `transactions` median query for matching narration pattern)*

**Approval required:** No

**Notes:** If `is_anomalous = true`, do NOT auto-assign — call `queue_quick_tag` instead with the user rule's subcategory as `suggested_subcategory_key` and `card_note = "This looks larger than usual — is it still [subcategory name]?"`. This skill only runs when a user rule match exists; skip it entirely when classifying from scratch.

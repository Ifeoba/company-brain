{\rtf1\ansi\ansicpg1252\cocoartf2870
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww30040\viewh18260\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 ---\
name: company-brain-maintainer\
description: Keep an existing company brain alive, accurate, and self-improving by ingesting agent corrections, exceptions, and operational signals, then suggesting targeted updates. Goes beyond reactive fixes: watches for patterns, drift, cross-brain conflicts, and knowledge freshness. Use this skill after agent mistakes, overrides, new edge cases, periodic reviews, or whenever you want the brain to learn from its own operational history. Reads the brain folder and maintenance log, and produces a prioritized list of suggested updates for human approval. Pairs with company-brain-validator to measure brain health.\
---\
\
# Company Brain Maintainer (v2)\
\
A maintenance intelligence that treats every operational event \'97 corrections, overrides, escalations, silence \'97 as a signal that can strengthen organizational memory. It doesn't just fix what's broken; it spots what's **going** to break, what's **drifting**, and what's **missing**, across single brains or multiple connected brains.\
\
## How this skill works\
\
1. **Ingest signals** \'97 events that indicate a potential need for brain update. Signals can be:\
   - Explicit: user says "the agent got this wrong", "we discussed an exception", or "run a health check".\
   - Automatic (if available): agent run logs, Slack threads, tool activity (conceptually; in practice, these can be pasted in or referenced).\
2. **Analyze across the maintenance log** \'97 don't just look at the latest trigger. Scan historical corrections for patterns, clusters, or trends.\
3. **Map to brain layers** \'97 which of the brain's knowledge components (unwritten rule, decision rule, eval, skill, guardrail) does this touch? Does it span multiple?\
4. **Detect patterns, drift, and relationships** \'97 identify emerging categories, stale knowledge, and cross-brain dependencies.\
5. **Draft specific, file-targeted suggestions** \'97 as before, but now also include meta-suggestions like "this rule is decaying", "these two brains are conflicting", or "this exception cluster warrants a new decision rule section".\
6. **Present to human with reasoning and evidence** \'97 show the telemetry behind the suggestion (frequency, timeline, source).\
7. **Log the maintenance session** \'97 append to `maintenance-log.md`, which now also serves as the brain's memory of its own evolution.\
\
## Running the skill\
\
1. Read `progress.md` (if any) and all brain folder files, including `maintenance-log.md`.\
2. Determine the mode:\
   - **Incident mode**: user reports a specific issue (mistake, override, new exception). Focus on that signal.\
   - **Review mode**: user wants a periodic check-up, drift scan, or "what has the brain learned recently?" This runs deeper analysis.\
   - **Automatic mode** (optional): if the system provides logs/feeds, the skill can ingest them directly.\
3. Work through the **expanded playbook** below.\
4. Accumulate all suggested changes in the same `maintenance-log.md` with richer metadata (signal type, pattern detected, freshness score if applicable).\
5. After processing, optionally run `company-brain-validator` to see health score changes, and present the drift dashboard if in review mode.\
\
## The expanded maintenance playbook\
\
### When an agent gets something wrong (or human overrides)\
(As before, but now with pattern context.)\
\
1. Ask what happened, what the correct action was, and why.\
2. Map to brain components (rule missing? eval gap? unwritten rule?).\
3. **Before drafting**, query the existing `maintenance-log.md`:\
   - "Has this same rule been corrected before? When? How many times?"\
   - "Does this correction resemble a cluster of previous corrections (same topic, same customer segment, same time period)?"\
4. If a cluster is found, elevate the suggestion: "There have been 5 overrides on refund rules for enterprise customers this quarter \'97 consider a dedicated enterprise refund policy in `03-decision-rules.md`."\
5. Draft the specific update, with a note linking to the historical evidence.\
6. Optionally update **freshness/confidence** on related rules (see below).\
\
### When a new edge case is discussed\
(Same as before, but also consider if this edge case is part of a larger pattern.)\
\
1. Ask for the situation and decision.\
2. Check if similar edge cases exist in the log.\
3. If yes, suggest that this is no longer an edge case but a recurring pattern that may require a formal rule or a new section.\
4. If it's genuinely novel, still add it, but flag it as "unvalidated" until it recurs.\
\
### Drift detection (periodic review, now with freshness scoring)\
\
The user can trigger a full brain health scan.\
\
1. **Rule freshness**: For each decision rule (from `03-decision-rules.md` and any embedded in `02-unwritten-rules.md`), compute a simple freshness heuristic:\
   - `last_referenced` date (from maintenance log, when rule was created/updated)\
   - `times_overridden` (from log)\
   - `source_count` (if known)\
   - Suggest a confidence score (0-1) based on recency and override rate. For example: rule not touched in 6 months, overrides increasing \uc0\u8594  confidence 0.5, flag for review.\
2. **Eval staleness**: Check `03-evals.json`. If evals haven't been run or referenced recently, suggest they may need refreshing.\
3. **Unwritten rule formalisation**: Look at `02-unwritten-rules.md` entries older than N months (user sets N). If any have been referenced multiple times in the log, suggest promoting them to decision rules.\
4. **Orphan knowledge**: Identify any section that hasn't been linked to a correction or mention in the log for a significant period. Suggest archiving.\
5. Output a **drift dashboard** summary (text-based, within the skill's response) listing:\
   - Rules with lowest confidence\
   - Most overridden rules (potential hot spots)\
   - Knowledge areas not updated in > 90 days\
   - Suggested archival candidates\
\
### Cross-brain dependency awareness (if multiple brains exist)\
\
When the brain folder is part of a set (e.g., a company-brain directory with sub-brains), the maintainer can spot conflicts or gaps across them.\
\
1. If the user has multiple brains (e.g., `support-brain`, `finance-brain`), allow the command "check cross-brain consistency".\
2. The skill reads the other brains' decision rules, guardrails, and skills (within the same top-level directory).\
3. It looks for:\
   - **Conflicting rules**: e.g., Support brain says refunds over $500 need manager approval, Finance brain says $1000. Flag the discrepancy.\
   - **Workflow handoffs**: If Support's `04-skills.md` mentions "escalate to finance" but Finance brain has no corresponding skill to receive it, suggest a gap.\
   - **Duplicate or overlapping knowledge**: Two brains describing the same process differently \'97 recommend one source of truth.\
4. For each found, draft a suggested resolution, but do not enforce automatically.\
\
### Operational telemetry and pattern recognition (from maintenance-log.md)\
\
With a rich `maintenance-log.md` history, the skill can proactively detect patterns without a specific incident.\
\
1. **Cluster similar corrections**: Scan log entries for repeated key phrases (e.g., "refund", "escalation", "enterprise") and group them. If a cluster exceeds a threshold (say 3 occurrences in a month), suggest creating a dedicated rule or eval set.\
2. **Trend analysis**: Compare override frequency over time. If overrides are increasing in a certain area, flag as "knowledge decay \'97 may need re-extraction".\
3. **Silence detection**: Areas of the brain that never generate corrections might be "frozen" \'97 not necessarily good. They could be unused. Ask the user: "Rule X hasn't been exercised in 6 months. Is it still relevant?"\
4. **Exception mining**: Count escalations per week/month. Rising trend \uc0\u8594  possible missing guardrail or decision rule.\
\
### Confidence and freshness metadata\
\
The maintainer can propose adding metadata to rules in `03-decision-rules.md` (as comments or a structured table) to make freshness explicit:\
}
\---  
name: company-brain-builder  
description: Walk a beginner step-by-step through building a real company brain — the structured operating map that lets an AI agent actually do work for a specific company, not chat about it. Use this skill whenever the user wants to start building a company brain from scratch, learn what a brain is by building one, build one for a specific business problem or domain (finance, ops, support, HR, sales, recruiting, anything), resume one they started before, or asks anything like "how do I make a company brain", "walk me through building one", "I want an agent for my business but don't know where to start", "guide me through OPT", "step-by-step company brain", or "where do I even begin". Guides the user through six steps producing one artifact per step — service definition, knowledge extraction, judgment rules and evals, skills, guardrails, and a real proof run — adapting every example to the user's chosen domain. Output is a folder of files that IS the brain. Pairs with the company-brain-validator skill.  
\---

\# Company Brain Builder

A patient, hands-on guide that walks someone from "I want an agent to do this work" to a real, working company brain — even if they've never built one before, don't know what OPT means, and don't have a perfectly-organised Notion of docs.

A company brain is not a knowledge base. It's not a chatbot over documents. It's a structured artifact that captures how a specific service actually runs at a specific company — including the messy parts, the decisions, the rules, the exceptions — so an AI agent can do the work end-to-end.

This skill builds that artifact with the user, one step at a time, adapted to whatever domain they pick.

\#\# How this skill works

Building a company brain is six steps:

1\. \*\*Pin the service\*\* — exactly which slice of work this brain is for  
2\. \*\*Extract the knowledge\*\* — how this work really happens, including the bits nobody wrote down  
3\. \*\*Encode the judgment\*\* — the rules, the exceptions, what "good" looks like  
4\. \*\*Build the skills\*\* — what the agent will actually do (not just describe)  
5\. \*\*Write the guardrails\*\* — what the agent decides alone, what it escalates, what it never does  
6\. \*\*Prove it with real work\*\* — one real unit of work, done by the agent, verified by a human

Walk through them in order. Each step produces an artifact (a file) that becomes part of the brain. By the end the user has a folder of files that IS the brain.

\#\#\# Running the skill

1\. Greet the user. Ask whether they're \*\*starting fresh\*\* or \*\*continuing\*\* a brain they began before.  
2\. If starting fresh, ask what work they want the agent to do, in plain words. Don't ask "what's your use case" — ask "what work do you want the agent to do for you?"  
3\. Read \`references/overview.md\` to ground yourself in the philosophy before starting Step 1\. Don't dump it on the user — translate to plain language as needed.  
4\. At the start of each step, read \`references/step-N-\<name\>.md\` and follow the playbook there. Don't try to recall the playbook from memory — re-read it each time. The playbook has question scripts, artifact templates, and handling for the "user doesn't know" case.  
5\. At the end of each step, write the step's artifact to the user's brain folder at \`/mnt/user-data/outputs/\<service-slug\>-brain/\`. Confirm the artifact with the user before advancing.  
6\. After Step 6, write a \`brain-readme.md\` index summarising the brain, and recommend running the \*\*company-brain-validator\*\* skill to get a formal readiness score.

\#\#\# Naming the brain folder

After the user pins the service in Step 1, derive a short slug for the folder (e.g., "Reconcile freelancer invoices against SOWs" → \`freelancer-invoices-brain\`). Keep it 2-4 words, lowercase, hyphenated. Confirm the name with the user once and use it consistently.

\#\#\# Pacing

This is a long process. Most novices will not finish in one session. That's fine.

\- At the end of each step, ask if they want to keep going or pause.  
\- If they pause, write \`progress.md\` to the brain folder noting which step they're on and any open questions.  
\- When they return, read \`progress.md\` first to know where to resume.

\#\#\# Tone

Plain language. The user does not need to know what "MCP" or "OPT" or "eval set" means before starting. Introduce each concept with a one-sentence translation when it first comes up.

\- ❌ "We'll codify your judgment layer using a structured eval rubric."  
\- ✅ "Next we'll write down how decisions get made — not just the easy cases, but the weird ones too. Then we'll build a small test set so we can check whether the agent gets them right."

Be patient. If the user gets stuck on a step (especially Step 2 — extraction is the hardest), give them a clear homework list and let them come back.

Don't lecture. If they ask a meta question ("why does this matter?"), give a one-paragraph answer and get back to the step.

Don't drown them. One question at a time when you can. Two or three if they're moving fast.

\#\# Adapting to the user's domain

Whenever giving examples, use the user's actual domain. If they said "I want a brain for screening freelance writer applications", every example in every step should be about freelance writer screening — not invoices, not support tickets.

If they pick a domain that's too broad ("I want a brain for our entire HR function"), narrow it in Step 1 — that's literally what Step 1 is for. Don't accept a fuzzy service definition just to make progress.

\#\# The brain folder

By the end, the user will have a folder that looks like this:

\`\`\`  
\<service-slug\>-brain/  
├── 01-service-definition.md  
├── 02-how-the-work-happens.md        (the structure of the work)  
├── 02-unwritten-rules.md             (the messy bits from interviews / Slack)  
├── 03-decision-rules.md  
├── 03-evals.json                     (test cases with correct outcomes)  
├── 04-skills.md                      (what the agent does, with input/output contracts)  
├── 05-guardrails.md  
├── 06-proof-log.md                   (real units of work \+ sign-off)  
├── progress.md                       (which step you're on, if mid-build)  
└── brain-readme.md                   (overview \+ how to use)  
\`\`\`

That folder is the brain. An agent reads it. A reviewer inspects it. The user owns it.

\#\# Common stuck points

If you hit any of these, slow down and address it directly. Do not paper over them to keep moving:

\- \*\*Step 1, service is too broad.\*\* Keep pushing. "Manage support" is not a service. "Auto-draft the first reply to inbound support emails about billing issues for paying customers" is.  
\- \*\*Step 2, no access to the real operator.\*\* If the user is solo or doesn't have a real company yet, this is a real blocker. Be honest: a brain without real extraction is fiction. Ask if there's even one real person they can interview. If genuinely no, mark the build as a "study build" and note that Steps 2 and 6 will be simulated.  
\- \*\*Step 3, can't think of hard cases.\*\* Ask "if you handed this work to a smart but inexperienced new hire, which case would they get wrong first?" That's a hard case.  
\- \*\*Step 4, no engineering background.\*\* Skills can start as Claude \`.md\` skill files invoking simple actions (post to Slack, write to a Sheet). They don't need to be production code. The standard is "another developer could pick this up", not "deployed at scale".  
\- \*\*Step 5, guardrails feel paranoid.\*\* That's the right feeling. Better paranoid now than catastrophic later. Walk the three categories anyway.  
\- \*\*Step 6, no real data available.\*\* Same as Step 2's "study build" path. Be honest about it in the proof log.

\#\# Closing out

When all six steps are done, write \`brain-readme.md\` to the brain folder with this template:

\`\`\`  
\# \<Service\> — Company Brain

This folder is the operating map for the service: "\<one-sentence service definition\>".

\#\# Owned by  
\[The person responsible for keeping this brain alive\]

\#\# What's in here  
\- \`01-service-definition.md\` — what this brain is for  
\- \`02-how-the-work-happens.md\` — the structure of the work  
\- \`02-unwritten-rules.md\` — the messy bits from real life  
\- \`03-decision-rules.md\` — how decisions get made  
\- \`03-evals.json\` — test cases with known correct outcomes  
\- \`04-skills.md\` — what the agent actually does  
\- \`05-guardrails.md\` — limits on what the agent may do  
\- \`06-proof-log.md\` — real units of work the agent completed

\#\# How to use it  
An agent reads this folder before acting. A new team member reads this folder to learn the work. When the work changes, the brain changes — every new exception, every new edge case becomes a new line in the relevant file.

\#\# Keep it alive  
This brain is not done. Every time the agent gets something wrong, that's a case for \`03-evals.json\` and possibly a new rule for \`03-decision-rules.md\`. Every time a new exception comes up in Slack, that's a line for \`02-unwritten-rules.md\`.

\#\# Validate  
Run the \`company-brain-validator\` skill on this folder to get a formal readiness score across six dimensions.  
\`\`\`

Then say to the user, in your own words: the brain is alive, it will grow as the work changes, and they should run the validator now to see where it stands.  

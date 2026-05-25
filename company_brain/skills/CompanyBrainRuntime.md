{\rtf1\ansi\ansicpg1252\cocoartf2870
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 ---\
name: company-brain-runtime\
description: The runtime layer that connects a company brain folder to live company tools, executes agent actions, captures corrections, and feeds the maintainer. Completely tool-agnostic: it works through abstract capabilities that each company maps to their own stack. Use this skill to start or manage the operational loop for an existing brain. Requires a company profile, capability definitions, and a tool mapping to be fully operational.\
---\
\
# Company Brain Runtime\
\
The runtime is the bridge between the static brain folder and the actual work of the company. It is **tool-agnostic** \'97 it knows what needs to happen (capabilities) but not which tool does it. That mapping is provided by the company.\
\
It requires:\
- An existing brain folder built by `company-brain-builder`.\
- A `company-profile.json` that declares which tools the company uses.\
- A `capabilities.json` that defines the abstract operations the runtime can request.\
- A `tool-mapping.json` that maps those capabilities to concrete tool methods for the company's chosen stack.\
- `skill-contracts.json` (now referencing capabilities, not tools).\
- `permissions.json` (roles control which capabilities an agent may use).\
- Connectors to the actual tools (configured via the company profile).\
\
## How the runtime works (tool-agnostic loop)\
\
1. **Ingest** events from connected tools (Slack, GitHub, ticket systems). Connectors are instantiated based on the company profile.\
2. **Match** events to action contracts in `skill-contracts.json`. Contracts describe which **capabilities** they need.\
3. **Resolve tools**: look up the required capabilities in `tool-mapping.json` to find the actual tool method for this company (e.g., "get_ticket" \uc0\u8594  the company\'92s support tool\'92s API call).\
4. **Validate permissions** using `permissions.json` (roles own capabilities) and brain guardrails.\
5. **Execute** or **queue for approval** based on contract conditions.\
6. **Log** every action, outcome, and correction.\
7. **Capture human corrections** (edits) as events for the maintainer.\
8. **Report** health and lineage.\
\
The runtime never hardcodes any tool name or domain-specific logic. All examples (billing, invoices, Zendesk) live only in sample profiles and brain folders \'97 not in the engine.\
\
## Key JSON files (stored alongside the brain folder in a `runtime/` subdirectory)\
\
- `company-profile.json` \'97 which tools this company uses.\
- `capabilities.json` \'97 the universe of abstract operations the runtime understands.\
- `tool-mapping.json` \'97 mapping from capabilities to actual tool methods per company.\
- `skill-contracts.json` \'97 skill contracts using capabilities.\
- `permissions.json` \'97 role-based access to capabilities.\
- `event-schema.json` \'97 standard event schema (unchanged).\
- `runtime-config.json` \'97 triggers and thresholds.\
- `brain-metadata.json` \'97 freshness and confidence.\
\
## Boundaries\
\
- The runtime never modifies the brain folder directly. Updates go through the maintainer.\
- It enforces guardrails strictly and always respects the human-in-the-loop approval rules.\
- All company-specific information is isolated in the profile, mappings, and brain artifacts \'97 never in the engine.---\
name: company-brain-runtime\
description: The runtime layer that connects a company brain folder to live company tools, executes agent actions, captures corrections, and feeds the maintainer. Completely tool-agnostic: it works through abstract capabilities that each company maps to their own stack. Use this skill to start or manage the operational loop for an existing brain. Requires a company profile, capability definitions, and a tool mapping to be fully operational.\
---\
\
# Company Brain Runtime\
\
The runtime is the bridge between the static brain folder and the actual work of the company. It is **tool-agnostic** \'97 it knows what needs to happen (capabilities) but not which tool does it. That mapping is provided by the company.\
\
It requires:\
- An existing brain folder built by `company-brain-builder`.\
- A `company-profile.json` that declares which tools the company uses.\
- A `capabilities.json` that defines the abstract operations the runtime can request.\
- A `tool-mapping.json` that maps those capabilities to concrete tool methods for the company's chosen stack.\
- `skill-contracts.json` (now referencing capabilities, not tools).\
- `permissions.json` (roles control which capabilities an agent may use).\
- Connectors to the actual tools (configured via the company profile).\
\
## How the runtime works (tool-agnostic loop)\
\
1. **Ingest** events from connected tools (Slack, GitHub, ticket systems). Connectors are instantiated based on the company profile.\
2. **Match** events to action contracts in `skill-contracts.json`. Contracts describe which **capabilities** they need.\
3. **Resolve tools**: look up the required capabilities in `tool-mapping.json` to find the actual tool method for this company (e.g., "get_ticket" \uc0\u8594  the company\'92s support tool\'92s API call).\
4. **Validate permissions** using `permissions.json` (roles own capabilities) and brain guardrails.\
5. **Execute** or **queue for approval** based on contract conditions.\
6. **Log** every action, outcome, and correction.\
7. **Capture human corrections** (edits) as events for the maintainer.\
8. **Report** health and lineage.\
\
The runtime never hardcodes any tool name or domain-specific logic. All examples (billing, invoices, Zendesk) live only in sample profiles and brain folders \'97 not in the engine.\
\
## Key JSON files (stored alongside the brain folder in a `runtime/` subdirectory)\
\
- `company-profile.json` \'97 which tools this company uses.\
- `capabilities.json` \'97 the universe of abstract operations the runtime understands.\
- `tool-mapping.json` \'97 mapping from capabilities to actual tool methods per company.\
- `skill-contracts.json` \'97 skill contracts using capabilities.\
- `permissions.json` \'97 role-based access to capabilities.\
- `event-schema.json` \'97 standard event schema (unchanged).\
- `runtime-config.json` \'97 triggers and thresholds.\
- `brain-metadata.json` \'97 freshness and confidence.\
\
## Boundaries\
\
- The runtime never modifies the brain folder directly. Updates go through the maintainer.\
- It enforces guardrails strictly and always respects the human-in-the-loop approval rules.\
- All company-specific information is isolated in the profile, mappings, and brain artifacts \'97 never in the engine.}
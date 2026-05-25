{\rtf1\ansi\ansicpg1252\cocoartf2870
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 ---\
name: workflow-state-engine\
description: Durable execution state management for the Company Brain Runtime. Persists workflow instance state, handles checkpointing, resume after failure, replay, and inspection. This skill is the memory of the runtime \'97 it ensures that no in-progress work is ever lost and that every action can be traced and replayed. Used by the execution-policy-engine to save and load state, and exposed directly for debugging and operational visibility.\
---\
\
# Workflow State Engine\
\
The Workflow State Engine is responsible for the **durability** of all workflows running in the Company Brain Runtime. It provides the guarantees that a long-running or multi-step workflow can survive process crashes, be resumed exactly where it left off, and be audited step by step.\
\
It does **not** execute any business logic itself \'97 that's the Execution Policy Engine's job. It simply ensures that the state of every running, paused, or completed workflow is recorded and recoverable.\
\
## How it works\
\
1. **Persist state**: When a workflow instance is created or updated, the State Engine writes the full state to a durable store (local JSON files by default, configurable to a database).\
2. **Checkpoint**: After each step is completed, the Execution Policy Engine calls `checkpoint(instance_id, state)`. The State Engine atomically updates the persisted record.\
3. **Resume on startup**: When the runtime starts, the State Engine scans for any instances in `running` or `compensating` status and offers them to the Execution Policy Engine for resumption.\
4. **Replay**: A completed or failed instance can be replayed from its initial input events, with the State Engine providing the historical decision trace.\
5. **Inspect**: The State Engine provides a query interface to retrieve the current state of any workflow instance, its step status, outputs, and errors.\
\
## Key Concepts\
\
- **Workflow Instance**: A single execution of a policy. Identified by a unique `workflow_instance_id`. Contains all state needed to resume or audit the run.\
- **Step State**: For each node in the policy's execution graph, the state records: `status` (pending, running, completed, failed, skipped, compensating, compensated), `output`, `attempts`, `last_error`, `started_at`, `completed_at`.\
- **Checkpoint**: A durable snapshot of the entire instance after each step. If a crash occurs, the system can resume from the last completed step without re-executing earlier steps.\
- **Idempotency Key**: Some tool calls may have been started but not confirmed. The State Engine can store a `pending_commit` marker so the runtime can safely re-run or verify the tool's status during resume.\
- **Compensation State**: Tracks which compensation steps have run, preventing double compensation on re-resume.\
\
## Data Schema (per instance)\
\
```json\
\{\
  "workflow_instance_id": "wf-abc123",\
  "policy_id": "billing-ticket-reply",\
  "brain_id": "billing-support-brain",\
  "status": "running",\
  "started_at": "2026-05-25T10:12:00Z",\
  "last_updated": "2026-05-25T10:12:15Z",\
  "input": \{ ... \},\
  "steps": \{\
    "fetch_ticket": \{\
      "status": "completed",\
      "output": \{ ... \},\
      "attempts": 1,\
      "started_at": "2026-05-25T10:12:01Z",\
      "completed_at": "2026-05-25T10:12:05Z",\
      "last_error": null\
    \},\
    "lookup_customer": \{\
      "status": "completed",\
      "output": \{ ... \},\
      "attempts": 1,\
      "started_at": "2026-05-25T10:12:06Z",\
      "completed_at": "2026-05-25T10:12:08Z",\
      "last_error": null\
    \},\
    "draft_reply_enterprise": \{\
      "status": "pending"\
    \},\
    "post_comment": \{\
      "status": "pending"\
    \}\
  \},\
  "compensation_state": null,\
  "error": null\
\}}
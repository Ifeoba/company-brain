{\rtf1\ansi\ansicpg1252\cocoartf2870
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 ---\
name: execution-policy-engine\
description: Execute workflows defined in execution-policies.json with full control flow, retries, compensation, and durable state. This skill is the orchestration core of the Company Brain Runtime. It loads policies, resolves capabilities to tool calls, manages step execution, and checkpoints progress so workflows survive crashes. Use it to start a new workflow instance, resume a failed one, or inspect execution state. It is typically invoked by the runtime automatically but can be called directly for debugging or manual workflow execution.\
---\
\
# Execution Policy Engine\
\
The Execution Policy Engine is the part of the Company Brain Runtime that actually **runs** work. It takes a policy (a workflow definition), an input event, and a brain context, and executes the steps \'97 sequentially or as a DAG \'97 while handling retries, failures, compensations, and state persistence.\
\
It does **not** know about specific tools, domains, or company logic. It operates purely on **capabilities** and the **abstract workflow graph**. Tool resolution is handled externally via `tool-mapping.json`, and permissions are checked by the runtime before the engine is called. The engine's job is to make sure that the right things happen in the right order, and that the system can recover from anything.\
\
## How it works\
\
1. **Receive a command**: `start_workflow(policy_id, input, brain_id)`. This can come from an event listener in the runtime, a human trigger, or a scheduled job.\
2. **Load the policy**: read the `policy_id` from `execution-policies.json` in the brain folder. The policy defines nodes, edges, retry defaults, failure strategies, and compensations.\
3. **Create a workflow instance**: assign a unique `workflow_instance_id`, initialize state, and persist it to the state store (as configured in `runtime-config.json`).\
4. **Execute the DAG**: resolve the execution graph, run steps in dependency order, handle decisions, retries, and failures according to the policy.\
5. **Checkpoint after every step**: write updated state to disk so the workflow can resume exactly where it left off after a crash.\
6. **Handle completion**: on success, mark the instance complete; on unhandled failure, run compensation chain and escalate.\
\
## Inputs (when called directly)\
\
- `policy_id` (string) \'97 the ID of a policy defined in `execution-policies.json`\
- `input` (object) \'97 the triggering event payload, e.g. a ticket object\
- `brain_id` (string) \'97 which brain folder to read from\
- `resume_instance_id` (optional, string) \'97 if resuming an existing instance instead of starting a new one\
\
## Configuration files it reads\
\
- `execution-policies.json` \'97 the policy definitions and workflow graphs\
- `runtime-config.json` \'97 execution limits, default retries, state engine settings, timeouts\
- `company-profile.json` \'97 tells the runtime which tools exist (for capability resolution, though the engine itself delegates that)\
- `tool-mapping.json` \'97 maps abstract capabilities to concrete tool methods\
- `permissions.json` \'97 role-based access (enforced before the engine is called, but the engine may re-verify capability availability)\
- `brain-metadata.json` \'97 updated with rule execution counts, overrides, confidence changes\
- `skill-contracts.json` \'97 some skills reference a default execution policy; the engine may be called via a contract's `execution_policy` field\
\
## Execution Flow (internal)\
\
### 1. DAG Construction\
If the policy type is `"graph"`, the engine builds a directed acyclic graph from the `nodes` and `edges` arrays. It performs a topological sort to determine execution order. Nodes with no incoming edges are roots; nodes with an `edges` dependency wait for predecessors.\
\
### 2. Step Execution Loop\
The engine maintains a `ready` queue of nodes whose dependencies are satisfied. It processes them one at a time (or in parallel if concurrency limits allow). For each node:\
\
- Evaluate `condition` (if present). If false, mark the node as `skipped` and propagate to downstream nodes that use `join: "any"`.\
- If it's an `action` node:\
  - Resolve the `capability` to an actual tool method via the tool mapping layer.\
  - Prepare input by resolving JSONPath references in `input_map` against the workflow state (outputs of previous steps and original input).\
  - Execute the tool call with the configured retry policy (step-level overrides or global defaults).\
  - On success, store output and mark node `completed`.\
  - On failure after all retries, apply the `on_failure` action: `skip`, `stop`, `compensate_and_stop`, etc.\
- If it's a `decision` node:\
  - Evaluate the condition and execute the true/false branch (branches are themselves arrays of steps).\
- After each node completes (or fails), **checkpoint** the instance state.\
\
### 2. Parallelism\
Nodes that are independent (no dependency edges between them) can be executed concurrently. The engine respects a `max_concurrent_workflows` limit from `runtime-config.json` but also allows internal step parallelism. Join gates (`join: "any"` or `join: "all"`) control when a node fires after multiple predecessors.\
\
### 3. Compensation\
If a node fails with a compensation action defined, the engine runs the compensation step (also a capability call) immediately. If multiple nodes have already completed and the policy defines a `compensation_chain`, the engine walks the completed nodes in reverse order and executes their compensations.\
\
### 4. Workflow State Persistence\
The state engine persists a JSON blob per instance. The schema includes:\
\
- `workflow_instance_id`\
- `policy_id`\
- `brain_id`\
- `status` (`running`, `completed`, `failed`, `compensating`)\
- `current_step` or graph progress marker\
- `steps` object mapping each node id to its status, output, attempts, and errors\
- `compensation_state` (which compensations have run)\
- `checkpoint_timestamp`\
\
On resume, the engine reloads this state and continues from the first incomplete node.\
\
## State Management (Checkpointing & Resume)\
\
- **Checkpoint strategy**: after each step (configurable in `runtime-config.json`).\
- **Storage**: JSON files in `\{brain_folder\}/runtime/state/` (default), but pluggable to databases.\
- **Resume on startup**: The runtime scans for any `running` instances and feeds them back into the engine.\
- **Idempotency**: Steps should be idempotent where possible; the state engine records if a step's tool call was started but not confirmed, allowing the runtime to re-run safely.\
\
## Error Handling & Global Escalation\
\
- Each step can have its own `on_failure` behavior. If it exhausts its retries and the action is `stop` or `compensate_and_stop`, the workflow halts.\
- The policy's `global_error_handling` defines what happens next: `escalate_to_human`, `compensate_and_escalate`, or `none`.\
- Escalation uses a capability like `send_message` to notify a designated channel, including the workflow instance ID and failure context.\
\
## Interaction with the Maintainer\
\
Every action (step execution) is logged as a `BrainEvent` (with `event_type: action_completed` or `action_failed`). When the engine encounters a failure that results in compensation, it logs an `exception` event. Human corrections captured by the runtime are also events. The maintainer later scans these events and suggests brain updates.\
\
## Boundaries\
\
- The engine never modifies brain files (decision rules, guardrails). It only updates `brain-metadata.json` with execution statistics (override counts, last referenced timestamps).\
- It does not enforce permissions \'97 that's the runtime's job before calling the engine.\
- It does not resolve abstract capabilities to concrete tools; it calls an internal `tool_resolver` function provided by the runtime.\
- All knowledge about *what* to do is in the brain folder; the engine only knows *how* to orchestrate.\
\
## Example Usage (via runtime)\
\
```json\
\{\
  "command": "start_workflow",\
  "policy_id": "billing-ticket-reply",\
  "input": \{\
    "ticket_id": "392",\
    "customer_id": "cust-44",\
    "body": "I was charged twice...",\
    "subject": "Duplicate charge"\
  \},\
  "brain_id": "billing-support-brain"\
\}}
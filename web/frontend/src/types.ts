export interface User {
  id: string;
  github_username: string;
  email: string;
  avatar_url: string;
  has_api_key: boolean;
  llm_provider: string;
  created_at: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
  key_hint: string;
  key_url: string;
}

export interface BrainSummary {
  id: string;
  slug: string;
  name: string;
  readiness_score: number;
  updated_at: string;
  status: "in-formation" | "ready" | "stale";
}

export interface BrainDetail extends BrainSummary {
  created_at: string;
  owner_id: string;
}

export interface FileSummary {
  filename: string;
  has_content: boolean;
  placeholder_count: number;
  updated_at: string | null;
}

export interface FileContent {
  filename: string;
  content: string;
  updated_at: string | null;
}

export interface FileDimension {
  filename: string;
  exists: boolean;
  placeholder_count: number;
  note: string;
}

export interface ReadinessOut {
  score: number;
  files: FileDimension[];
}

export interface Question {
  key: string;
  text: string;
}

export interface Step {
  number: number;
  name: string;
  files: string[];
  json_files: string[];
  questions: Question[];
}

export interface InterviewState {
  current_step: number;
  current_question_index: number;
  answers: Record<string, Record<string, string>>;
  steps: Step[];
}

export interface Collaborator {
  id: string;
  name: string;
  email: string;
  initials: string;
  color_seed: number;
  created_at: string;
}

export interface ExpertQuestion {
  id: string;
  token: string;
  collaborator_id: string;
  collaborator_name: string;
  step_number: number;
  question_key: string;
  question_text: string;
  context_text: string;
  status: "pending" | "answered" | "expired";
  created_at: string;
  expires_at: string;
  answer_text: string | null;
}

export interface PublicQuestion {
  brain_name: string;
  asker_name: string;
  recipient_name: string;
  question_text: string;
  context_text: string;
  already_answered: boolean;
  existing_answer: string | null;
}

export interface BrainUpdateLink {
  token: string;
}

export interface BrainUpdate {
  id: string;
  contributor_name: string;
  contributor_email: string;
  topic: string;
  content: string;
  status: "pending" | "integrated" | "dismissed";
  created_at: string;
}

export interface PublicBrainUpdate {
  brain_name: string;
  asker_name: string;
}

export interface BrainRelationship {
  id: string;
  from_slug: string;
  from_name: string;
  to_slug: string;
  to_name: string;
  rel_type: string;
  created_at: string;
}

export interface WorkspaceNode {
  id: string;
  slug: string;
  name: string;
  readiness_score: number;
  status: string;
  relationships: BrainRelationship[];
}

export interface RelationshipSuggestion {
  from_slug: string;
  from_name: string;
  to_slug: string;
  to_name: string;
  rel_type: string;
  reason: string;
}

export interface SemanticReviewOut {
  summary: string;
  strengths: string[];
  gaps: string[];
  contradictions: string[];
  suggestions: string[];
  score: number;
}

// ── Runtime (Tier 3) ──────────────────────────────────────────────────────────

export interface ReviewOut {
  id: string;
  verdict: "approved" | "corrected" | "rejected";
  notes: string;
  corrected_decision: string | null;
  created_at: string;
}

export interface RunOut {
  id: string;
  brain_id: string;
  case_text: string;
  case_filename: string | null;
  decision_text: string | null;
  cited_rules: string[];
  model_used: string;
  tokens_in: number;
  tokens_out: number;
  status: "pending" | "queued" | "running" | "awaiting_approval" | "completed" | "failed";
  error_text: string | null;
  created_at: string;
  completed_at: string | null;
  review: ReviewOut | null;
  cost_usd: number;
}

export interface RunListItem {
  id: string;
  case_text: string;
  case_filename: string | null;
  decision_text: string | null;
  status: "pending" | "queued" | "running" | "awaiting_approval" | "completed" | "failed";
  created_at: string;
  verdict: "approved" | "corrected" | "rejected" | null;
  cost_usd: number;
}

export interface TriggerOut {
  id: string;
  kind: "webhook" | "email" | "schedule" | "database" | "manual";
  name: string;
  is_active: boolean;
  last_fired_at: string | null;
  created_at: string;
  cron_expression: string | null;
  inbound_email: string | null;
  secret: string | null;
  webhook_url: string | null;
}

// ── Tools ─────────────────────────────────────────────────────────────────────

export interface ToolOut {
  id: string;
  name: string;
  description: string;
  category: string;
  risk: "safe" | "confirm" | "escalate";
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export interface BuiltinTool {
  name: string;
  description: string;
  category: string;
  risk: string;
  config_template: Record<string, unknown>;
}

export interface VaultSecretSummary {
  name: string;
  updated_at: string;
}

// ── Brain stats ───────────────────────────────────────────────────────────────

export interface BrainStatsOut {
  total_runs: number;
  completed_runs: number;
  failed_runs: number;
  total_cost_usd: number;
  last_run_at: string | null;
}

// ── Maintainer suggestions ────────────────────────────────────────────────────

export interface MaintainerSuggestionOut {
  id: string;
  pattern_type: string;
  finding: string;
  proposed_diff: string | null;
  target_file: string | null;
  status: "pending" | "accepted" | "dismissed";
  created_at: string;
  resolved_at: string | null;
}

// ── Escalations ───────────────────────────────────────────────────────────────

export interface EscalationToolCall {
  id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
  status: string;
}

export interface EscalationOut {
  id: string;
  status: "pending" | "resolved";
  reason: string;
  guardrail_cited: string | null;
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
  run_id: string;
  run_case_snippet: string;
  brain_slug: string;
  brain_name: string;
  tool_call: EscalationToolCall | null;
}

// ── Audit log ─────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown>;
  occurred_at: string;
  actor_id: string | null;
}

// ── Run trace ─────────────────────────────────────────────────────────────────

export interface RunStepOut {
  id: string;
  step_index: number;
  kind: "thinking" | "tool_call" | "approval_requested" | "approval_granted" | "tool_executed" | "tool_failed" | "guardrail_blocked" | "final_decision";
  content: string | null;
  metadata: Record<string, unknown>;
  occurred_at: string | null;
}

export interface RunTraceOut {
  run: RunOut;
  steps: RunStepOut[];
}

// ── Tool calls (approval flow) ─────────────────────────────────────────────────

export interface ToolCallOut {
  id: string;
  tool_id: string;
  tool_name: string;
  tool_description: string;
  arguments: Record<string, unknown>;
  status: "pending_approval" | "approved" | "executed" | "failed" | "denied";
  result: Record<string, unknown> | null;
  error: string | null;
  requested_at: string;
  decided_at: string | null;
  executed_at: string | null;
}

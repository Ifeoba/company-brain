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

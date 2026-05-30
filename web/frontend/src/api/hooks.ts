import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiBlob } from "./client";
import type {
  AuditLogEntry, BrainDetail, BrainRelationship, BrainStatsOut, BrainSummary, BrainUpdate, BrainUpdateLink,
  BuiltinTool, Collaborator, EscalationOut, ExpertQuestion, FileContent, FileSummary, InterviewState,
  MaintainerSuggestionOut, ProviderInfo, PublicBrainUpdate, PublicQuestion, ReadinessOut, RelationshipSuggestion,
  RunListItem, RunOut, SemanticReviewOut, ToolCallOut, ToolOut, TriggerOut, User, VaultSecretSummary, WorkspaceNode,
} from "../types";

// ── Auth ──────────────────────────────────────────────────────────────────────

export function useMe() {
  return useQuery<User>({
    queryKey: ["me"],
    queryFn: () => api("/api/me"),
    retry: false,
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api("/api/auth/logout", { method: "POST" }),
    onSuccess: () => {
      qc.clear();
      window.location.href = "/login";
    },
  });
}

export function useProviders() {
  return useQuery<ProviderInfo[]>({
    queryKey: ["providers"],
    queryFn: () => api("/api/me/providers"),
    staleTime: Infinity,
  });
}

export function useSetApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, api_key }: { provider: string; api_key: string }) =>
      api("/api/me/api-key", { method: "PUT", body: JSON.stringify({ provider, api_key }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function useDeleteApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api("/api/me/api-key", { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
}

// ── Brains ────────────────────────────────────────────────────────────────────

export function useBrains() {
  return useQuery<BrainSummary[]>({
    queryKey: ["brains"],
    queryFn: () => api("/api/brains"),
  });
}

export function useBrain(slug: string) {
  return useQuery<BrainDetail>({
    queryKey: ["brain", slug],
    queryFn: () => api(`/api/brains/${slug}`),
    enabled: !!slug,
  });
}

export function useCreateBrain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; slug?: string }) =>
      api<BrainDetail>("/api/brains", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brains"] }),
  });
}

export function useDeleteBrain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => api(`/api/brains/${slug}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brains"] }),
  });
}

export function useReadiness(slug: string) {
  return useQuery<ReadinessOut>({
    queryKey: ["readiness", slug],
    queryFn: () => api(`/api/brains/${slug}/readiness`),
    enabled: !!slug,
  });
}

export function useSemanticReview(slug: string) {
  return useMutation<SemanticReviewOut>({
    mutationFn: () => api(`/api/brains/${slug}/semantic-review`, { method: "POST" }),
  });
}

// ── Files ─────────────────────────────────────────────────────────────────────

export function useFiles(slug: string) {
  return useQuery<FileSummary[]>({
    queryKey: ["files", slug],
    queryFn: () => api(`/api/brains/${slug}/files`),
    enabled: !!slug,
  });
}

export function useFile(slug: string, filename: string) {
  return useQuery<FileContent>({
    queryKey: ["file", slug, filename],
    queryFn: () => api(`/api/brains/${slug}/files/${filename}`),
    enabled: !!slug && !!filename,
    retry: false,
  });
}

export function useUpdateFile(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ filename, content }: { filename: string; content: string }) =>
      api<FileContent>(`/api/brains/${slug}/files/${filename}`, {
        method: "PUT",
        body: JSON.stringify({ content }),
      }),
    onSuccess: (_, { filename }) => {
      qc.invalidateQueries({ queryKey: ["file", slug, filename] });
      qc.invalidateQueries({ queryKey: ["files", slug] });
      qc.invalidateQueries({ queryKey: ["readiness", slug] });
      qc.invalidateQueries({ queryKey: ["brain", slug] });
    },
  });
}

// ── Interview ─────────────────────────────────────────────────────────────────

export function useInterview(slug: string) {
  return useQuery<InterviewState>({
    queryKey: ["interview", slug],
    queryFn: () => api(`/api/brains/${slug}/interview`),
    enabled: !!slug,
  });
}

export function useSaveAnswer(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { step: number; question_key: string; answer_text: string }) =>
      api<InterviewState>(`/api/brains/${slug}/interview/answer`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      qc.setQueryData(["interview", slug], data);
    },
  });
}

export function useUpdateProgress(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { current_step: number; current_question_index: number }) =>
      api<InterviewState>(`/api/brains/${slug}/interview`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => qc.setQueryData(["interview", slug], data),
  });
}

export function useGenerate(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { step: number; filename: string }) =>
      api<{ content: string }>(`/api/brains/${slug}/interview/generate`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (_, { filename }) => {
      qc.invalidateQueries({ queryKey: ["file", slug, filename] });
      qc.invalidateQueries({ queryKey: ["files", slug] });
      qc.invalidateQueries({ queryKey: ["readiness", slug] });
    },
  });
}

// ── Collaborators ─────────────────────────────────────────────────────────────

export function useCollaborators(slug: string) {
  return useQuery<Collaborator[]>({
    queryKey: ["collaborators", slug],
    queryFn: () => api(`/api/brains/${slug}/collaborators`),
    enabled: !!slug,
  });
}

export function useAddCollaborator(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; email: string }) =>
      api<Collaborator>(`/api/brains/${slug}/collaborators`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collaborators", slug] }),
  });
}

// ── Expert questions ──────────────────────────────────────────────────────────

export function useExpertQuestions(slug: string) {
  return useQuery<ExpertQuestion[]>({
    queryKey: ["expert-questions", slug],
    queryFn: () => api(`/api/brains/${slug}/expert-questions`),
    enabled: !!slug,
  });
}

export function useAskExpert(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      collaborator_id: string;
      step: number;
      question_key: string;
      question_text: string;
      context_text?: string;
    }) =>
      api<ExpertQuestion>(`/api/brains/${slug}/ask-expert`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expert-questions", slug] }),
  });
}

// ── Public expert page ────────────────────────────────────────────────────────

export function usePublicQuestion(token: string) {
  return useQuery<PublicQuestion>({
    queryKey: ["public-question", token],
    queryFn: () => api(`/api/expert/${token}`),
    enabled: !!token,
    retry: false,
  });
}

export function useSubmitAnswer(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (answer_text: string) =>
      api(`/api/expert/${token}/answer`, {
        method: "POST",
        body: JSON.stringify({ answer_text }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["public-question", token] }),
  });
}

// ── Continuous capture (brain updates) ────────────────────────────────────────

export function useGetUpdateLink(slug: string) {
  return useMutation({
    mutationFn: () =>
      api<BrainUpdateLink>(`/api/brains/${slug}/update-link`, { method: "POST" }),
  });
}

export function useBrainUpdates(slug: string) {
  return useQuery<BrainUpdate[]>({
    queryKey: ["brain-updates", slug],
    queryFn: () => api(`/api/brains/${slug}/updates`),
    enabled: !!slug,
  });
}

export function useIntegrateUpdate(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (update_id: string) =>
      api(`/api/brains/${slug}/updates/${update_id}/integrate`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brain-updates", slug] });
      qc.invalidateQueries({ queryKey: ["files", slug] });
      qc.invalidateQueries({ queryKey: ["readiness", slug] });
    },
  });
}

export function useDismissUpdate(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (update_id: string) =>
      api(`/api/brains/${slug}/updates/${update_id}/dismiss`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brain-updates", slug] }),
  });
}

export function usePublicBrainUpdate(token: string) {
  return useQuery<PublicBrainUpdate>({
    queryKey: ["public-brain-update", token],
    queryFn: () => api(`/api/update/${token}`),
    enabled: !!token,
    retry: false,
  });
}

export function useSubmitBrainUpdate(token: string) {
  return useMutation({
    mutationFn: (body: {
      contributor_name: string;
      contributor_email?: string;
      topic?: string;
      content: string;
    }) =>
      api(`/api/update/${token}`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}

// ── Knowledge graph (brain relationships) ────────────────────────────────────

export function useWorkspaceMap() {
  return useQuery<WorkspaceNode[]>({
    queryKey: ["workspace-map"],
    queryFn: () => api("/api/workspace/map"),
  });
}

export function useBrainRelationships(slug: string) {
  return useQuery<BrainRelationship[]>({
    queryKey: ["relationships", slug],
    queryFn: () => api(`/api/brains/${slug}/relationships`),
    enabled: !!slug,
  });
}

export function useAddRelationship(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { to_slug: string; rel_type: string }) =>
      api<BrainRelationship>(`/api/brains/${slug}/relationships`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["relationships", slug] });
      qc.invalidateQueries({ queryKey: ["workspace-map"] });
    },
  });
}

export function useRemoveRelationship(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rel_id: string) =>
      api(`/api/brains/${slug}/relationships/${rel_id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["relationships", slug] });
      qc.invalidateQueries({ queryKey: ["workspace-map"] });
    },
  });
}

export function useDiscoverRelationships() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<RelationshipSuggestion[]>("/api/workspace/discover-relationships", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace-map"] }),
  });
}

export function useConfirmSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ from_slug, to_slug, rel_type }: { from_slug: string; to_slug: string; rel_type: string }) =>
      api(`/api/brains/${from_slug}/relationships`, {
        method: "POST",
        body: JSON.stringify({ to_slug, rel_type }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace-map"] }),
  });
}

// ── Export ────────────────────────────────────────────────────────────────────

export function useExport(slug: string) {
  return useMutation({
    mutationFn: async (force: boolean) => {
      const url = `/api/brains/${slug}/export${force ? "?force=true" : ""}`;
      const blob = await apiBlob(url);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${slug}-brain.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    },
  });
}

// ── Runtime (Tier 3) ──────────────────────────────────────────────────────────

export function useRuns(slug: string) {
  return useQuery<RunListItem[]>({
    queryKey: ["runs", slug],
    queryFn: () => api(`/api/brains/${slug}/runs`),
    enabled: !!slug,
  });
}

export function useRun(slug: string, runId: string | null) {
  return useQuery<RunOut>({
    queryKey: ["run", slug, runId],
    queryFn: () => api(`/api/brains/${slug}/runs/${runId}`),
    enabled: !!slug && !!runId,
    refetchInterval: (query) => {
      const data = query.state.data as RunOut | undefined;
      if (!data) return 1500;
      return ["completed", "failed"].includes(data.status) ? false : 1500;
    },
  });
}

export function useRunEvents(onEvent: (event: Record<string, unknown>) => void) {
  useEffect(() => {
    const src = new EventSource("/api/events", { withCredentials: true });
    src.onmessage = (e) => {
      try { onEvent(JSON.parse(e.data as string)); } catch {}
    };
    return () => src.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function useCreateRun(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { case_text: string; case_filename?: string }) =>
      api<{ run_id: string; status: string }>(`/api/brains/${slug}/runs`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["runs", slug] }),
  });
}

export function useReviewRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      runId,
      verdict,
      notes,
      corrected_decision,
    }: {
      runId: string;
      verdict: string;
      notes: string;
      corrected_decision?: string;
    }) =>
      api(`/api/runs/${runId}/review`, {
        method: "POST",
        body: JSON.stringify({ verdict, notes, corrected_decision }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["runs"] });
      qc.invalidateQueries({ queryKey: ["run"] });
      qc.invalidateQueries({ queryKey: ["unsynced-count"] });
    },
  });
}

export function useBrainStats(slug: string) {
  return useQuery<BrainStatsOut>({
    queryKey: ["brain-stats", slug],
    queryFn: () => api(`/api/brains/${slug}/stats`),
    enabled: !!slug,
    staleTime: 60000,
  });
}

export function useRetryRun(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) =>
      api(`/api/brains/${slug}/runs/${runId}/retry`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["runs", slug] });
      qc.invalidateQueries({ queryKey: ["run", slug] });
    },
  });
}

export function useUnsyncedCount(slug: string) {
  return useQuery<{ count: number }>({
    queryKey: ["unsynced-count", slug],
    queryFn: () => api(`/api/brains/${slug}/runs/unsynced-count`),
    enabled: !!slug,
    refetchInterval: 30000,
  });
}

export function useSyncEvals(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ synced_count: number }>(`/api/brains/${slug}/evals/sync`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unsynced-count", slug] });
      qc.invalidateQueries({ queryKey: ["readiness", slug] });
    },
  });
}

// ── Triggers ──────────────────────────────────────────────────────────────────

export function useTriggers(slug: string) {
  return useQuery<TriggerOut[]>({
    queryKey: ["triggers", slug],
    queryFn: () => api(`/api/brains/${slug}/triggers`),
    enabled: !!slug,
  });
}

export function useCreateTrigger(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { kind: string; name: string; cron_expression?: string; config?: Record<string, unknown> }) =>
      api<TriggerOut>(`/api/brains/${slug}/triggers`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["triggers", slug] }),
  });
}

export function useDeleteTrigger(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (triggerId: string) =>
      api(`/api/brains/${slug}/triggers/${triggerId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["triggers", slug] }),
  });
}

export function useToggleTrigger(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ triggerId, is_active }: { triggerId: string; is_active: boolean }) =>
      api<TriggerOut>(`/api/brains/${slug}/triggers/${triggerId}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["triggers", slug] }),
  });
}

// ── Tools ──────────────────────────────────────────────────────────────────────

export function useBuiltinTools() {
  return useQuery<BuiltinTool[]>({
    queryKey: ["tools", "builtins"],
    queryFn: () => api("/api/tools/builtins"),
  });
}

export function useWorkspaceTools() {
  return useQuery<ToolOut[]>({
    queryKey: ["workspace-tools"],
    queryFn: () => api("/api/workspace/tools"),
  });
}

export function useCreateWorkspaceTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description: string; category: string; risk: string; config: Record<string, unknown> }) =>
      api<ToolOut>("/api/workspace/tools", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace-tools"] }),
  });
}

export function useDeleteWorkspaceTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (toolId: string) =>
      api(`/api/workspace/tools/${toolId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace-tools"] }),
  });
}

export function useBrainTools(slug: string) {
  return useQuery<ToolOut[]>({
    queryKey: ["brain-tools", slug],
    queryFn: () => api(`/api/brains/${slug}/tools`),
    enabled: !!slug,
  });
}

export function useAttachTool(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (toolId: string) =>
      api<ToolOut>(`/api/brains/${slug}/tools/${toolId}`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brain-tools", slug] }),
  });
}

export function useDetachTool(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (toolId: string) =>
      api(`/api/brains/${slug}/tools/${toolId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brain-tools", slug] }),
  });
}

// ── Vault ──────────────────────────────────────────────────────────────────────

export function useVaultSecrets() {
  return useQuery<VaultSecretSummary[]>({
    queryKey: ["vault-secrets"],
    queryFn: () => api("/api/workspace/vault"),
  });
}

export function useStoreSecret() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; value: string }) =>
      api("/api/workspace/vault", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vault-secrets"] }),
  });
}

export function useDeleteSecret() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api(`/api/workspace/vault/${encodeURIComponent(name)}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vault-secrets"] }),
  });
}

// ── Maintainer suggestions ────────────────────────────────────────────────────

export function useSuggestions(slug: string) {
  return useQuery<MaintainerSuggestionOut[]>({
    queryKey: ["suggestions", slug],
    queryFn: () => api(`/api/brains/${slug}/suggestions`),
    enabled: !!slug,
  });
}

export function useAcceptSuggestion(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (suggestionId: string) =>
      api(`/api/brains/${slug}/suggestions/${suggestionId}/accept`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suggestions", slug] });
      qc.invalidateQueries({ queryKey: ["files", slug] });
      qc.invalidateQueries({ queryKey: ["readiness", slug] });
    },
  });
}

export function useDismissSuggestion(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (suggestionId: string) =>
      api(`/api/brains/${slug}/suggestions/${suggestionId}/dismiss`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suggestions", slug] }),
  });
}

export function useTriggerMaintainer(slug: string) {
  return useMutation({
    mutationFn: () =>
      api(`/api/brains/${slug}/suggestions/trigger`, { method: "POST" }),
  });
}

// ── Escalations ───────────────────────────────────────────────────────────────

export function useEscalations() {
  return useQuery<EscalationOut[]>({
    queryKey: ["escalations"],
    queryFn: () => api("/api/workspace/escalations"),
    refetchInterval: 30000,
  });
}

export function useResolveEscalation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ escId, verdict, resolution }: { escId: string; verdict: "approved" | "denied"; resolution?: string }) =>
      api(`/api/workspace/escalations/${escId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ verdict, resolution: resolution ?? "" }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["escalations"] });
      qc.invalidateQueries({ queryKey: ["runs"] });
      qc.invalidateQueries({ queryKey: ["run"] });
    },
  });
}

// ── Audit log ─────────────────────────────────────────────────────────────────

export function useAuditLog() {
  return useQuery<AuditLogEntry[]>({
    queryKey: ["audit-log"],
    queryFn: () => api("/api/workspace/audit-log"),
  });
}

// ── Tool call approval ─────────────────────────────────────────────────────────

export function useRunToolCalls(slug: string, runId: string | null) {
  return useQuery<ToolCallOut[]>({
    queryKey: ["run-tool-calls", slug, runId],
    queryFn: () => api(`/api/brains/${slug}/runs/${runId}/tool-calls`),
    enabled: !!slug && !!runId,
    refetchInterval: (query) => {
      const data = query.state.data as ToolCallOut[] | undefined;
      if (!data) return 2000;
      return data.some((tc) => tc.status === "pending_approval") ? 2000 : false;
    },
  });
}

export function useApproveToolCall(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ runId, tcId }: { runId: string; tcId: string }) =>
      api(`/api/brains/${slug}/runs/${runId}/tool-calls/${tcId}/approve`, { method: "POST" }),
    onSuccess: (_, { runId }) => {
      qc.invalidateQueries({ queryKey: ["run-tool-calls", slug, runId] });
      qc.invalidateQueries({ queryKey: ["run", slug, runId] });
      qc.invalidateQueries({ queryKey: ["runs", slug] });
    },
  });
}

export function useDenyToolCall(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ runId, tcId }: { runId: string; tcId: string }) =>
      api(`/api/brains/${slug}/runs/${runId}/tool-calls/${tcId}/deny`, { method: "POST" }),
    onSuccess: (_, { runId }) => {
      qc.invalidateQueries({ queryKey: ["run-tool-calls", slug, runId] });
      qc.invalidateQueries({ queryKey: ["run", slug, runId] });
      qc.invalidateQueries({ queryKey: ["runs", slug] });
    },
  });
}

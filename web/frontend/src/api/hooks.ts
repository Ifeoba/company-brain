import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiBlob } from "./client";
import type {
  BrainDetail, BrainRelationship, BrainSummary, BrainUpdate, BrainUpdateLink,
  Collaborator, ExpertQuestion, FileContent, FileSummary, InterviewState,
  PublicBrainUpdate, PublicQuestion, ReadinessOut, User, WorkspaceNode,
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

export function useSetApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (api_key: string) =>
      api("/api/me/anthropic-key", { method: "PUT", body: JSON.stringify({ api_key }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function useDeleteApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api("/api/me/anthropic-key", { method: "DELETE" }),
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

// ── Export ────────────────────────────────────────────────────────────────────

export function useExport(slug: string) {
  return useMutation({
    mutationFn: async () => {
      const blob = await apiBlob(`/api/brains/${slug}/export`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}-brain.zip`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}

let csrfToken: string | null = null;

async function fetchCsrf(): Promise<string> {
  const resp = await fetch("/api/csrf-token", { credentials: "include" });
  const data = await resp.json();
  csrfToken = data.csrf_token;
  return csrfToken!;
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    if (!csrfToken) {
      await fetchCsrf();
    }
    headers["X-CSRF-Token"] = csrfToken!;
  }

  const resp = await fetch(path, {
    ...options,
    credentials: "include",
    headers,
  });

  if (resp.status === 401) {
    window.location.href = "/login";
    throw new Error("Unauthenticated");
  }

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(body.detail || `HTTP ${resp.status}`);
  }

  if (resp.status === 204) return undefined as T;
  return resp.json();
}

export async function apiBlob(path: string): Promise<Blob> {
  const resp = await fetch(path, { credentials: "include" });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.blob();
}

// In local dev, this stays "/api" and Vite's dev-server proxy (see
// vite.config.ts) forwards it to localhost:4000 — nothing to configure.
// In production, frontend and backend are on different domains (Netlify +
// Render), so there's no proxy — VITE_API_URL must be set in Netlify's
// environment variables to the real backend URL, e.g.
// "https://ihops-web.onrender.com/api" or "https://api.ihops.ng/api".
const BASE = import.meta.env.VITE_API_URL || "/api";

function getToken() {
  return localStorage.getItem("ihops_token");
}
function getSuperAdminToken() {
  return localStorage.getItem("ihops_superadmin_token");
}

async function request(
  path: string,
  options: RequestInit = {},
  superAdmin = false,
) {
  const token = superAdmin ? getSuperAdminToken() : getToken();
  const headers: Record<string, string> = { ...(options.headers as any) };
  if (!(options.body instanceof FormData))
    headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await res.json() : await res.blob();

  if (!res.ok) {
    const err: any = new Error((data as any)?.error || "Request failed");
    err.data = data;
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (path: string) => request(path, { method: "GET" }),
  post: (path: string, body?: any) =>
    request(path, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  patch: (path: string, body?: any) =>
    request(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: (path: string) => request(path, { method: "DELETE" }),
};

export const superAdminApi = {
  get: (path: string) => request(path, { method: "GET" }, true),
  post: (path: string, body?: any) =>
    request(path, { method: "POST", body: JSON.stringify(body) }, true),
  patch: (path: string, body?: any) =>
    request(path, { method: "PATCH", body: JSON.stringify(body) }, true),
};

export function downloadFile(path: string, filename: string) {
  const token = getToken();
  fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
    .then((res) => res.blob())
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    });
}

export { getToken, getSuperAdminToken };

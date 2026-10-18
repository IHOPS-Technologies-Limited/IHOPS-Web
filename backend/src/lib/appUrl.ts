// Builds a link into the frontend from APP_BASE_URL. Tolerates a trailing
// slash on the env var (a trailing "/" once produced a broken verify link in
// production) and a missing leading slash on the path.
export function appUrl(path: string): string {
  const base = (process.env.APP_BASE_URL || "http://localhost:5173").replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

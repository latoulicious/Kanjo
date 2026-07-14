// Single fetch boundary to the API. Routes are single-origin under /api/v1
// (nginx in prod, Vite proxy in dev). Errors arrive as {"error": msg}.
// On device there is no server: the same paths are served by the local SQLite
// store (lib/db), dynamic-imported so the web bundle never ships it.
import { Capacitor } from "@capacitor/core"
import { ApiError } from "./api-error"

export { ApiError }

const BASE = "/api/v1"

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = body?.error ?? `request failed (${res.status})`
    throw new ApiError(res.status, msg)
  }
  return body as T
}

const native = Capacitor.isNativePlatform()

async function local<T>(method: string, path: string, body?: unknown): Promise<T> {
  const [{ localRequest }, { nativeDb }] = await Promise.all([
    import("./db/local-api"),
    import("./db/native"),
  ])
  return localRequest<T>(await nativeDb(), method, path, body)
}

export const api = {
  get: <T>(path: string) => (native ? local<T>("GET", path) : request<T>(path)),
  post: <T>(path: string, body: unknown) =>
    native
      ? local<T>("POST", path, body)
      : request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    native
      ? local<T>("PUT", path, body)
      : request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  del: (path: string) =>
    native ? local<void>("DELETE", path) : request<void>(path, { method: "DELETE" }),
}

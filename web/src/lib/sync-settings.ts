// Device-local sync config; localStorage survives app restarts in the WebView.
export interface SyncSettings {
  url: string
  token: string
  last: string | null
}

const KEY = "kanjo.sync"

function isSyncSettings(v: unknown): v is SyncSettings {
  if (typeof v !== "object" || v === null) return false
  const o = v as Record<string, unknown>
  return typeof o.url === "string" && typeof o.token === "string" && (o.last === null || typeof o.last === "string")
}

export function loadSyncSettings(): SyncSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isSyncSettings(parsed)) return { url: parsed.url, token: parsed.token, last: parsed.last }
    }
  } catch {
    // corrupted settings fall back to defaults
  }
  return { url: "", token: "", last: null }
}

export function saveSyncSettings(s: SyncSettings): void {
  localStorage.setItem(KEY, JSON.stringify(s))
}

export function autoSyncDue(s: SyncSettings): boolean {
  return s.url !== ""
}

// Device-local sync config; localStorage survives app restarts in the WebView.
export interface SyncSettings {
  url: string
  token: string
  auto: boolean // weekly fallback: sync on launch when last sync > 7 days old
  last: string | null
}

const KEY = "kanjo.sync"
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function loadSyncSettings(): SyncSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { url: "", token: "", auto: false, last: null, ...(JSON.parse(raw) as Partial<SyncSettings>) }
  } catch {
    // corrupted settings fall back to defaults
  }
  return { url: "", token: "", auto: false, last: null }
}

export function saveSyncSettings(s: SyncSettings): void {
  localStorage.setItem(KEY, JSON.stringify(s))
}

export function autoSyncDue(s: SyncSettings): boolean {
  if (!s.auto || !s.url) return false
  const last = s.last == null ? NaN : Date.parse(s.last)
  return !Number.isFinite(last) || Date.now() - last > WEEK_MS
}

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { ApiError } from "@/lib/api"
import { loadSyncSettings, saveSyncSettings } from "@/lib/sync-settings"

export function SyncPage() {
  const qc = useQueryClient()
  const [settings, setSettings] = useState(loadSyncSettings)
  const [busy, setBusy] = useState(false)

  function update(patch: Partial<typeof settings>) {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveSyncSettings(next)
  }

  async function run(repair: boolean) {
    if (!settings.url) {
      toast.error("Set the server URL first")
      return
    }
    setBusy(true)
    try {
      const [{ runSync, repairSync }, { nativeDb }] = await Promise.all([
        import("@/lib/db/sync"),
        import("@/lib/db/native"),
      ])
      const db = await nativeDb()
      const result = repair
        ? await repairSync(db, settings.url, settings.token)
        : await runSync(db, settings.url, settings.token)
      update({ last: result.syncedAt })
      await qc.invalidateQueries()
      toast.success(`Synced — ${result.pushed} change${result.pushed === 1 ? "" : "s"} pushed`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Sync failed — check URL and network")
    } finally {
      setBusy(false)
    }
  }

  function repairNow() {
    if (!window.confirm("Re-link this phone with the server? Use after a server restore. Entries logged on this phone are kept.")) return
    void run(true)
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div>
        <h1 className="text-lg font-medium">Sync</h1>
        <p className="text-sm text-muted-foreground">
          Push this phone's ledger to your server and pull everything back. Optional — the app is fully local without it.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <Label htmlFor="sync-url">Server URL</Label>
          <Input
            id="sync-url"
            placeholder="https://kanjo.example.com"
            inputMode="url"
            autoCapitalize="off"
            value={settings.url}
            onChange={(e) => update({ url: e.target.value.trim() })}
          />
        </div>
        <div>
          <Label htmlFor="sync-token">Sync token</Label>
          <Input
            id="sync-token"
            type="password"
            placeholder="empty if the server has none"
            value={settings.token}
            onChange={(e) => update({ token: e.target.value.trim() })}
          />
        </div>
        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <Label htmlFor="sync-auto" className="font-normal">
            Auto-sync weekly on launch
          </Label>
          <Switch id="sync-auto" checked={settings.auto} onCheckedChange={(auto) => update({ auto })} />
        </div>
      </div>

      <Button size="lg" onClick={() => void run(false)} disabled={busy}>
        {busy ? "Syncing…" : "Sync now"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        {settings.last ? `Last synced ${new Date(settings.last).toLocaleString()}` : "Never synced"}
      </p>

      <div className="rounded-md border border-border px-3 py-3">
        <p className="mb-2 text-xs text-muted-foreground">
          Server restored from a backup and sync now fails? Repair re-links this phone to the restored data. Entries logged here are kept.
        </p>
        <Button variant="outline" className="w-full" onClick={repairNow} disabled={busy}>
          Repair sync
        </Button>
      </div>
    </div>
  )
}

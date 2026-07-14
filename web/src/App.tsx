import { lazy, Suspense, useEffect } from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Layout } from "@/components/Layout"
import { isNative } from "@/lib/platform"
import { autoSyncDue, loadSyncSettings, saveSyncSettings } from "@/lib/sync-settings"
import { QuickEntryPage } from "@/features/quick/QuickEntryPage"
import { SyncPage } from "@/features/sync/SyncPage"
import { DashboardPage } from "@/features/dashboard/DashboardPage"
import { AccountsPage } from "@/features/accounts/AccountsPage"
import { GoalsPage } from "@/features/accounts/GoalsPage"
import { LedgerPage } from "@/features/transactions/LedgerPage"
import { RecurringPage } from "@/features/recurring/RecurringPage"
import { NameCrud } from "@/features/shared/NameCrud"

// Reports pulls in Recharts (heavy); lazy-load it so the chart bundle only ships
// when the page is visited.
const ReportsPage = lazy(() =>
  import("@/features/reports/ReportsPage").then((m) => ({
    default: m.ReportsPage,
  })),
)

// Weekly fallback: sync silently on launch when enabled and >7 days stale.
function useAutoSync() {
  const qc = useQueryClient()
  useEffect(() => {
    if (!isNative) return
    const settings = loadSyncSettings()
    if (!autoSyncDue(settings)) return
    void (async () => {
      try {
        const [{ runSync }, { nativeDb }] = await Promise.all([
          import("@/lib/db/sync"),
          import("@/lib/db/native"),
        ])
        const result = await runSync(await nativeDb(), settings.url, settings.token)
        saveSyncSettings({ ...loadSyncSettings(), last: result.syncedAt })
        await qc.invalidateQueries()
        toast.success("Weekly sync done")
      } catch {
        toast.error("Weekly sync failed — open Sync to retry")
      }
    })()
  }, [qc])
}

export default function App() {
  useAutoSync()
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Native is offline-first: quick entry replaces the dashboard, reports need the server. */}
        <Route index element={isNative ? <QuickEntryPage /> : <DashboardPage />} />
        <Route path="ledger" element={<LedgerPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="goals" element={<GoalsPage />} />
        <Route path="recurring" element={<RecurringPage />} />
        <Route
          path="categories"
          element={
            <NameCrud
              path="categories"
              title="Categories"
              subtitle="Buckets you classify spending into."
              singular="category"
              placeholder="e.g. Housing"
              withIcon
              withBudget
            />
          }
        />
        <Route
          path="projects"
          element={
            <NameCrud
              path="projects"
              title="Projects"
              subtitle="Initiatives that own transactions, so their cost is visible."
              singular="project"
              placeholder="e.g. LazyScan Lite"
              withIcon
            />
          }
        />
        {isNative && <Route path="sync" element={<SyncPage />} />}
        {!isNative && (
          <Route
            path="reports"
            element={
              <Suspense
                fallback={
                  <p className="text-sm text-muted-foreground">Loading reports…</p>
                }
              >
                <ReportsPage />
              </Suspense>
            }
          />
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

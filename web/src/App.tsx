import { lazy, Suspense } from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import { Layout } from "@/components/Layout"
import { DashboardPage } from "@/features/dashboard/DashboardPage"
import { AccountsPage } from "@/features/accounts/AccountsPage"
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

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="ledger" element={<LedgerPage />} />
        <Route path="accounts" element={<AccountsPage />} />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

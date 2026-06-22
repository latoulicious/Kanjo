import { Routes, Route, Navigate } from "react-router-dom"
import { Layout } from "@/components/Layout"
import { Placeholder } from "@/components/Placeholder"
import { AccountsPage } from "@/features/accounts/AccountsPage"
import { NameCrud } from "@/features/shared/NameCrud"

// Feature pages land slice by slice; routes render placeholders until then.
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Placeholder title="Dashboard" />} />
        <Route path="ledger" element={<Placeholder title="Ledger" />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route
          path="categories"
          element={
            <NameCrud
              path="categories"
              title="Categories"
              subtitle="Buckets you classify spending into."
              singular="category"
              placeholder="e.g. Housing"
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
            />
          }
        />
        <Route path="reports" element={<Placeholder title="Reports" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

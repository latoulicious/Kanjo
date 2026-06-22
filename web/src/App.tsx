import { Routes, Route, Navigate } from "react-router-dom"
import { Layout } from "@/components/Layout"
import { Placeholder } from "@/components/Placeholder"
import { AccountsPage } from "@/features/accounts/AccountsPage"

// Feature pages land slice by slice; routes render placeholders until then.
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Placeholder title="Dashboard" />} />
        <Route path="ledger" element={<Placeholder title="Ledger" />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="categories" element={<Placeholder title="Categories" />} />
        <Route path="projects" element={<Placeholder title="Projects" />} />
        <Route path="reports" element={<Placeholder title="Reports" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

import { NavLink, Outlet } from "react-router-dom"
import {
  LayoutDashboard,
  BookText,
  Wallet,
  Tags,
  FolderKanban,
  BarChart3,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { HealthBadge } from "@/components/HealthBadge"

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/ledger", label: "Ledger", icon: BookText, end: false },
  { to: "/accounts", label: "Accounts", icon: Wallet, end: false },
  { to: "/categories", label: "Categories", icon: Tags, end: false },
  { to: "/projects", label: "Projects", icon: FolderKanban, end: false },
  { to: "/reports", label: "Reports", icon: BarChart3, end: false },
]

export function Layout() {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-60 flex-col border-r border-border bg-card">
        <div className="px-5 py-6">
          <span className="font-serif text-xl font-medium">勘定</span>
          <span className="ml-2 text-sm text-muted-foreground">Kanjo</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border px-5 py-4">
          <HealthBadge />
        </div>
      </aside>
      <main className="flex-1 overflow-auto px-8 py-8">
        <Outlet />
      </main>
    </div>
  )
}

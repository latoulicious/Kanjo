import { useState } from "react"
import { NavLink, Outlet } from "react-router-dom"
import {
  LayoutDashboard,
  BookText,
  Wallet,
  Target,
  Tags,
  FolderKanban,
  Repeat,
  BarChart3,
  Menu,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { HealthBadge } from "@/components/HealthBadge"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/ledger", label: "Ledger", icon: BookText, end: false },
  { to: "/accounts", label: "Accounts", icon: Wallet, end: false },
  { to: "/goals", label: "Goals", icon: Target, end: false },
  { to: "/categories", label: "Categories", icon: Tags, end: false },
  { to: "/projects", label: "Projects", icon: FolderKanban, end: false },
  { to: "/recurring", label: "Recurring", icon: Repeat, end: false },
  { to: "/reports", label: "Reports", icon: BarChart3, end: false },
]

// Shared by the desktop sidebar and the mobile drawer. onNavigate closes the
// drawer on tap; the sidebar passes nothing.
function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
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
    </>
  )
}

export function Layout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-60 flex-col border-r border-border bg-card md:flex">
        <div className="px-5 py-6">
          <span className="font-serif text-xl font-medium">勘定</span>
          <span className="ml-2 text-sm text-muted-foreground">Kanjo</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          <NavItems />
        </nav>
        <div className="border-t border-border px-5 py-4">
          <HealthBadge />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className="rounded-md p-1 text-muted-foreground hover:bg-secondary/60 hover:text-foreground">
              <Menu className="size-5" />
              <span className="sr-only">Open navigation</span>
            </SheetTrigger>
            <SheetContent side="left" className="w-60 p-0">
              <SheetHeader className="px-5 py-6">
                <SheetTitle className="font-normal">
                  <span className="font-serif text-xl font-medium">勘定</span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    Kanjo
                  </span>
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-1 flex-col gap-1 px-3">
                <NavItems onNavigate={() => setOpen(false)} />
              </nav>
            </SheetContent>
          </Sheet>
          <span className="font-serif text-lg font-medium">勘定</span>
          <span className="text-sm text-muted-foreground">Kanjo</span>
          <div className="ml-auto">
            <HealthBadge />
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden overflow-y-auto px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

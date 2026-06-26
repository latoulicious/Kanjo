import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatAmount, toNumber } from "@/lib/money"
import type { Account } from "@/types"
import { CategoryIcon } from "@/features/shared/CategoryIcon"
import { useAccounts } from "./hooks"
import { AccountDialog } from "./AccountDialog"

// Goals are just accounts with a target_amount; fund them via transfers. This
// page is a read+edit view over that subset — no separate goal entity.
export function GoalsPage() {
  const { data: accounts, isLoading, isError } = useAccounts()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Account | undefined>()

  const goals = accounts?.filter((a) => a.target_amount != null) ?? []

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-medium">Goals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Savings targets. Fund one by transferring into its account.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="size-4" /> New goal
        </Button>
      </header>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
      {isError && (
        <p className="text-sm text-muted-foreground">Failed to load goals.</p>
      )}
      {!isLoading && !isError && goals.length === 0 && (
        <div className="rounded-lg border border-border bg-card py-12 text-center text-sm text-muted-foreground">
          No goals yet. Give any account a target to start one.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {goals.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            onClick={() => {
              setEditing(goal)
              setDialogOpen(true)
            }}
          />
        ))}
      </div>

      <AccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={editing}
      />
    </div>
  )
}

function GoalCard({ goal, onClick }: { goal: Account; onClick: () => void }) {
  const target = toNumber(goal.target_amount ?? "0")
  const balance = toNumber(goal.balance)
  const pct = target > 0 ? (balance / target) * 100 : 0
  const width = Math.max(0, Math.min(100, pct))
  const reached = target > 0 && balance >= target

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-foreground/20"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 font-medium">
          <CategoryIcon
            name={goal.icon}
            className="size-4 text-muted-foreground"
          />
          {goal.name}
        </span>
        <span
          className={cn(
            "text-sm tabular-nums",
            reached ? "text-emerald-600" : "text-muted-foreground",
          )}
        >
          {Math.round(pct)}%{reached ? " · reached" : ""}
        </span>
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-secondary">
        <div
          className={cn(
            "h-2 rounded-full",
            reached ? "bg-emerald-600" : "bg-primary",
          )}
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="mt-2 font-mono text-sm tabular-nums text-muted-foreground">
        {formatAmount(goal.balance)} / {formatAmount(goal.target_amount ?? "0")}
      </div>
    </button>
  )
}

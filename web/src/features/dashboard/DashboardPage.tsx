import { useMemo } from "react"
import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { ArrowRight } from "lucide-react"
import { toast } from "sonner"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useResourceList } from "@/lib/resources"
import { formatAmount, toNumber } from "@/lib/money"
import { cn } from "@/lib/utils"
import { ApiError } from "@/lib/api"
import type { Account, Category, Recurring } from "@/types"
import { CategoryIcon } from "@/features/shared/CategoryIcon"
import { useSummary, useCategoryReport } from "@/features/reports/hooks"
import { useTransactions } from "@/features/transactions/hooks"
import { usePostRecurring } from "@/features/recurring/hooks"
import { isDue } from "@/lib/recurring"
import { isoDate, cycleStart } from "@/lib/cycle"

// Dashboard reuses the report summary + ledger list (both server-derived);
// useTransactions({}) shares its cache key with the ledger's unfiltered view.
const RECENT_LIMIT = 8

export function DashboardPage() {
  const summary = useSummary({})
  const { data: txs, isLoading, isError } = useTransactions({})
  const accounts = useResourceList<Account>("accounts")
  const categories = useResourceList<Category>("categories")
  // Budget status compares each budgeted category against this pay cycle's spend.
  const cycleSpend = useCategoryReport({ from: isoDate(cycleStart()) })
  // "Due" is computed client-side from day_of_month + last_posted (no cron).
  const recurring = useResourceList<Recurring>("recurring")
  const post = usePostRecurring()
  const due = useMemo(
    () => (recurring.data ?? []).filter((r) => isDue(r)),
    [recurring.data],
  )

  function logDue(rule: Recurring) {
    post.mutate(rule.id, {
      onSuccess: () => toast.success("Logged"),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "Log failed"),
    })
  }

  const budgets = useMemo(() => {
    const spentById = new Map(
      (cycleSpend.data ?? []).map((c) => [c.category_id, toNumber(c.total)]),
    )
    return (categories.data ?? [])
      .filter((c) => c.monthly_budget != null && c.monthly_budget !== "")
      .map((c) => {
        const limit = toNumber(c.monthly_budget as string)
        const spent = spentById.get(c.id) ?? 0
        return { id: c.id, name: c.name, icon: c.icon, limit, spent }
      })
  }, [categories.data, cycleSpend.data])

  const accountById = useMemo(
    () => new Map((accounts.data ?? []).map((a) => [a.id, a])),
    [accounts.data],
  )
  const categoryById = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c])),
    [categories.data],
  )

  const s = summary.data
  const savingsRate = s
    ? s.savings_rate == null
      ? "—"
      : `${(toNumber(s.savings_rate) * 100).toFixed(1)}%`
    : "…"
  const runway = s
    ? s.runway_months == null
      ? "∞"
      : `${toNumber(s.runway_months).toFixed(1)} mo`
    : "…"

  const recent = txs?.slice(0, RECENT_LIMIT) ?? []

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-2xl font-medium">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Where the money stands{s ? ` · ${s.from} → ${s.to}` : ""}.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric
          label="Current Balance"
          value={s ? formatAmount(s.current_balance) : "…"}
        />
        <Metric
          label="Monthly Burn"
          value={s ? formatAmount(s.monthly_burn) : "…"}
        />
        <Metric label="Savings Rate" value={savingsRate} />
        <Metric label="Runway" value={runway} />
      </div>

      {due.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Due</CardTitle>
            <CardDescription>
              Recurring entries ready to log this cycle.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {due.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="inline-flex items-center gap-2 font-medium">
                  <CategoryIcon
                    name={
                      r.category_id != null
                        ? categoryById.get(r.category_id)?.icon
                        : accountById.get(r.account_id)?.icon
                    }
                  />
                  {r.description || (
                    <span className="text-muted-foreground">—</span>
                  )}
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {formatAmount(r.amount)}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={post.isPending}
                    onClick={() => logDue(r)}
                  >
                    Log it
                  </Button>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {budgets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Budgets</CardTitle>
            <CardDescription>This pay cycle · spend vs limit.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {budgets.map((b) => {
              const over = b.spent - b.limit
              const pct = b.limit > 0 ? Math.min((b.spent / b.limit) * 100, 100) : 0
              return (
                <div key={b.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-2 font-medium">
                      <CategoryIcon name={b.icon} />
                      {b.name}
                    </span>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {formatAmount(String(b.spent))} / {formatAmount(String(b.limit))}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        over > 0 ? "bg-negative" : "bg-primary",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs">
                    {over > 0 ? (
                      <span className="text-negative">
                        Over by {formatAmount(String(over))}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {formatAmount(String(b.limit - b.spent))} left
                      </span>
                    )}
                  </p>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Recent Transactions</CardTitle>
          <CardDescription>The latest entries across all accounts.</CardDescription>
          <CardAction>
            <Button asChild variant="ghost" size="sm">
              <Link to="/ledger">
                View all <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Category</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <RowMessage>Loading…</RowMessage>}
              {isError && <RowMessage>Failed to load transactions.</RowMessage>}
              {!isLoading && !isError && recent.length === 0 && (
                <RowMessage>No transactions yet.</RowMessage>
              )}
              {recent.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {tx.occurred_on}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">
                      {tx.description || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </span>
                    {tx.transfer_group_id != null && (
                      <Badge variant="outline" className="ml-2 align-middle">
                        transfer
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={cn(
                        "font-mono tabular-nums",
                        tx.is_inflow ? "text-positive" : "text-negative",
                      )}
                    >
                      {tx.is_inflow ? "+" : "−"}
                      {formatAmount(tx.amount)}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      <CategoryIcon
                        name={accountById.get(tx.account_id)?.icon}
                      />
                      {accountById.get(tx.account_id)?.name ??
                        `#${tx.account_id}`}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {tx.category_id != null ? (
                      <span className="inline-flex items-center gap-2">
                        <CategoryIcon
                          name={categoryById.get(tx.category_id)?.icon}
                        />
                        {categoryById.get(tx.category_id)?.name ??
                          `#${tx.category_id}`}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <div className="font-mono text-base tabular-nums sm:text-lg">{value}</div>
      </CardContent>
    </Card>
  )
}

function RowMessage({ children }: { children: ReactNode }) {
  return (
    <TableRow>
      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
        {children}
      </TableCell>
    </TableRow>
  )
}

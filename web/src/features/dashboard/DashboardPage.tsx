import { useMemo } from "react"
import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { ArrowRight } from "lucide-react"
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
import type { Account, Category } from "@/types"
import { useSummary } from "@/features/reports/hooks"
import { useTransactions } from "@/features/transactions/hooks"

// Dashboard reuses the report summary + ledger list (both server-derived);
// useTransactions({}) shares its cache key with the ledger's unfiltered view.
const RECENT_LIMIT = 8

export function DashboardPage() {
  const summary = useSummary({})
  const { data: txs, isLoading, isError } = useTransactions({})
  const accounts = useResourceList<Account>("accounts")
  const categories = useResourceList<Category>("categories")

  const accountName = useMemo(
    () => new Map((accounts.data ?? []).map((a) => [a.id, a.name])),
    [accounts.data],
  )
  const categoryName = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c.name])),
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
                    {accountName.get(tx.account_id) ?? `#${tx.account_id}`}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {tx.category_id != null
                      ? (categoryName.get(tx.category_id) ?? `#${tx.category_id}`)
                      : "—"}
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
        <div className="font-mono text-lg tabular-nums">{value}</div>
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

import { useState } from "react"
import type { ReactNode } from "react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatAmount, toNumber } from "@/lib/money"
import { cn } from "@/lib/utils"
import type { ReportInterval } from "@/types"
import {
  useSummary,
  useCashFlow,
  useCategoryReport,
  useProjectReport,
  useBalanceTrend,
  type Range,
} from "./hooks"
import {
  CashFlowChart,
  BalanceTrendChart,
  CategoryChart,
  ProjectCostChart,
} from "./charts"
import { Button } from "@/components/ui/button"
import { isoDate, cycleStart, lastCycleEnd } from "@/lib/cycle"

export function ReportsPage() {
  const [range, setRange] = useState<Range>({})
  const [interval, setInterval] = useState<ReportInterval>("month")

  const summary = useSummary(range)
  const cashFlow = useCashFlow(range, interval)
  const categories = useCategoryReport(range)
  const projects = useProjectReport(range)
  const balance = useBalanceTrend(range, interval)

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
  const netTone = s && toNumber(s.net) < 0 ? "text-negative" : "text-positive"

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-medium">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything derived from transactions
            {s ? ` · ${s.from} → ${s.to}` : ""}.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRange({ from: isoDate(cycleStart(0)) })}
            >
              This cycle
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setRange({
                  from: isoDate(cycleStart(1)),
                  to: isoDate(lastCycleEnd()),
                })
              }
            >
              Last cycle
            </Button>
          </div>
          <Control label="From">
            <Input
              type="date"
              className="w-full sm:w-40"
              value={range.from ?? ""}
              onChange={(e) =>
                setRange((r) => ({ ...r, from: e.target.value || undefined }))
              }
            />
          </Control>
          <Control label="To">
            <Input
              type="date"
              className="w-full sm:w-40"
              value={range.to ?? ""}
              onChange={(e) =>
                setRange((r) => ({ ...r, to: e.target.value || undefined }))
              }
            />
          </Control>
          <Control label="Interval">
            <Select
              value={interval}
              onValueChange={(v) => setInterval(v as ReportInterval)}
            >
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="day">Day</SelectItem>
              </SelectContent>
            </Select>
          </Control>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Metric
          label="Current Balance"
          value={s ? formatAmount(s.current_balance) : "…"}
        />
        <Metric
          label="Liquid Balance"
          value={s ? formatAmount(s.liquid_balance) : "…"}
        />
        <Metric
          label="Income"
          value={s ? formatAmount(s.income) : "…"}
          tone="text-positive"
        />
        <Metric
          label="Expense"
          value={s ? formatAmount(s.expense) : "…"}
          tone="text-negative"
        />
        <Metric label="Net" value={s ? formatAmount(s.net) : "…"} tone={netTone} />
        <Metric label="Savings Rate" value={savingsRate} />
        <Metric
          label="Monthly Burn"
          value={s ? formatAmount(s.monthly_burn) : "…"}
        />
        <Metric label="Runway" value={runway} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Cash Flow" hint="Income vs expense per period">
          <CashFlowChart data={cashFlow.data ?? []} />
        </ChartCard>
        <ChartCard title="Balance Trend" hint="Cumulative balance over time">
          <BalanceTrendChart data={balance.data ?? []} />
        </ChartCard>
        <ChartCard title="Category Breakdown" hint="Expense by category">
          <CategoryChart data={categories.data ?? []} />
        </ChartCard>
        <ChartCard title="Project Cost" hint="Spend attributed to projects">
          <ProjectCostChart data={projects.data ?? []} />
        </ChartCard>
      </div>
    </div>
  )
}

function Control({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex w-full flex-col gap-1 text-xs text-muted-foreground sm:w-auto">
      {label}
      {children}
    </label>
  )
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: string
}) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <div className={cn("font-mono text-base tabular-nums sm:text-lg", tone)}>
          {value}
        </div>
      </CardContent>
    </Card>
  )
}

function ChartCard({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif">{title}</CardTitle>
        <CardDescription>{hint}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

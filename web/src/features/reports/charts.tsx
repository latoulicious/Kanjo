import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"
import { toNumber } from "@/lib/money"
import type {
  BalancePoint,
  CashFlowPoint,
  CategoryTotal,
  ProjectTotal,
} from "@/types"

const compactFmt = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
})
const compact = (v: number) => compactFmt.format(v)

function Empty() {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
      No data for this range.
    </div>
  )
}

const cashConfig = {
  income: { label: "Income", color: "var(--chart-2)" },
  expense: { label: "Expense", color: "var(--chart-3)" },
} satisfies ChartConfig

export function CashFlowChart({ data }: { data: CashFlowPoint[] }) {
  if (!data.length) return <Empty />
  const rows = data.map((p) => ({
    period: p.period,
    income: toNumber(p.income),
    expense: toNumber(p.expense),
  }))
  return (
    <ChartContainer config={cashConfig} className="h-64 w-full">
      <BarChart data={rows}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="period" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={compact} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="income" fill="var(--color-income)" radius={4} />
        <Bar dataKey="expense" fill="var(--color-expense)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}

const balConfig = {
  balance: { label: "Balance", color: "var(--chart-1)" },
} satisfies ChartConfig

export function BalanceTrendChart({ data }: { data: BalancePoint[] }) {
  if (!data.length) return <Empty />
  const rows = data.map((p) => ({ period: p.period, balance: toNumber(p.balance) }))
  return (
    <ChartContainer config={balConfig} className="h-64 w-full">
      <LineChart data={rows}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="period" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={compact} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line
          dataKey="balance"
          type="monotone"
          stroke="var(--color-balance)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  )
}

const catConfig = {
  total: { label: "Spent", color: "var(--chart-1)" },
} satisfies ChartConfig

export function CategoryChart({ data }: { data: CategoryTotal[] }) {
  if (!data.length) return <Empty />
  const rows = data.map((c) => ({ name: c.name, total: toNumber(c.total) }))
  return (
    <ChartContainer config={catConfig} className="h-64 w-full">
      <BarChart data={rows} layout="vertical" margin={{ left: 12 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={compact} />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          width={110}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="total" fill="var(--color-total)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}

const projConfig = {
  total: { label: "Cost", color: "var(--chart-4)" },
} satisfies ChartConfig

export function ProjectCostChart({ data }: { data: ProjectTotal[] }) {
  if (!data.length) return <Empty />
  const rows = data.map((p) => ({ name: p.name, total: toNumber(p.total) }))
  return (
    <ChartContainer config={projConfig} className="h-64 w-full">
      <BarChart data={rows} layout="vertical" margin={{ left: 12 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={compact} />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          width={110}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="total" fill="var(--color-total)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}

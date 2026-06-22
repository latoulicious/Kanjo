import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type {
  ReportSummary,
  CashFlowPoint,
  CategoryTotal,
  ProjectTotal,
  BalancePoint,
  ReportInterval,
} from "@/types"

export interface Range {
  from?: string
  to?: string
}

function queryString(r: Range, interval?: string): string {
  const p = new URLSearchParams()
  if (r.from) p.set("from", r.from)
  if (r.to) p.set("to", r.to)
  if (interval) p.set("interval", interval)
  const s = p.toString()
  return s ? `?${s}` : ""
}

export function useSummary(r: Range) {
  return useQuery({
    queryKey: ["reports", "summary", r],
    queryFn: () => api.get<ReportSummary>(`/reports/summary${queryString(r)}`),
  })
}

export function useCashFlow(r: Range, interval: ReportInterval) {
  return useQuery({
    queryKey: ["reports", "cash-flow", r, interval],
    queryFn: () =>
      api.get<CashFlowPoint[]>(`/reports/cash-flow${queryString(r, interval)}`),
  })
}

export function useCategoryReport(r: Range) {
  return useQuery({
    queryKey: ["reports", "categories", r],
    queryFn: () =>
      api.get<CategoryTotal[]>(`/reports/categories${queryString(r)}`),
  })
}

export function useProjectReport(r: Range) {
  return useQuery({
    queryKey: ["reports", "projects", r],
    queryFn: () =>
      api.get<ProjectTotal[]>(`/reports/projects${queryString(r)}`),
  })
}

export function useBalanceTrend(r: Range, interval: ReportInterval) {
  // balance-trend is cumulative from the earliest row; it ignores `from` and is
  // bounded only by `to`.
  return useQuery({
    queryKey: ["reports", "balance-trend", r.to, interval],
    queryFn: () =>
      api.get<BalancePoint[]>(
        `/reports/balance-trend${queryString({ to: r.to }, interval)}`,
      ),
  })
}

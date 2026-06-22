import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type {
  Transaction,
  TransactionInput,
  TransactionFilter,
  TransferInput,
  TransferResult,
} from "@/types"

const KEY = "transactions"

function queryString(f: TransactionFilter): string {
  const p = new URLSearchParams()
  if (f.from) p.set("from", f.from)
  if (f.to) p.set("to", f.to)
  if (f.account_id) p.set("account_id", String(f.account_id))
  if (f.category_id) p.set("category_id", String(f.category_id))
  if (f.project_id) p.set("project_id", String(f.project_id))
  const s = p.toString()
  return s ? `?${s}` : ""
}

export function useTransactions(filter: TransactionFilter) {
  return useQuery({
    queryKey: [KEY, filter],
    queryFn: () => api.get<Transaction[]>(`/transactions${queryString(filter)}`),
  })
}

// Any transaction or transfer write invalidates the whole ledger (and, later,
// the derived reports keyed elsewhere).
function useInvalidate() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: [KEY] })
}

export function useCreateTransaction() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: TransactionInput) =>
      api.post<Transaction>("/transactions", input),
    onSuccess: invalidate,
  })
}

export function useUpdateTransaction() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: TransactionInput }) =>
      api.put<Transaction>(`/transactions/${id}`, input),
    onSuccess: invalidate,
  })
}

export function useDeleteTransaction() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: number) => api.del(`/transactions/${id}`),
    onSuccess: invalidate,
  })
}

export function useCreateTransfer() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: TransferInput) =>
      api.post<TransferResult>("/transfers", input),
    onSuccess: invalidate,
  })
}

// Deletes the whole transfer group (the only way to remove a transfer — its legs
// can't be deleted singly).
export function useDeleteTransfer() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (groupId: string) => api.del(`/transfers/${groupId}`),
    onSuccess: invalidate,
  })
}

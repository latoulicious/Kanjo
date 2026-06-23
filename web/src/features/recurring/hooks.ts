import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Recurring, RecurringInput, Transaction } from "@/types"

const KEY = ["recurring"] as const

export function useRecurring() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api.get<Recurring[]>("/recurring"),
  })
}

export function useCreateRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RecurringInput) =>
      api.post<Recurring>("/recurring", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: RecurringInput }) =>
      api.put<Recurring>(`/recurring/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.del(`/recurring/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

// Logging a rule creates a real transaction, so invalidate everything a normal
// transaction write does (ledger + reports) plus the recurring list (last_posted
// changed, so the due widget should drop it).
export function usePostRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      api.post<Transaction>(`/recurring/${id}/post`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] })
      qc.invalidateQueries({ queryKey: ["reports"] })
      qc.invalidateQueries({ queryKey: KEY })
    },
  })
}

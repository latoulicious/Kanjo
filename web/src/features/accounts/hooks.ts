import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Account, AccountInput } from "@/types"

const KEY = ["accounts"] as const

export function useAccounts() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api.get<Account[]>("/accounts"),
  })
}

export function useCreateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AccountInput) => api.post<Account>("/accounts", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: AccountInput }) =>
      api.put<Account>(`/accounts/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.del(`/accounts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

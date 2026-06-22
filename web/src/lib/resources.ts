import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"

// Lists a named resource for selects/filters. queryKey [path] matches the CRUD
// pages' keys, so cache and invalidation are shared across the app.
export function useResourceList<T>(path: string) {
  return useQuery({
    queryKey: [path],
    queryFn: () => api.get<T[]>(`/${path}`),
  })
}

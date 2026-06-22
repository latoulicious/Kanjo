import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"

interface Health {
  status: string
  db: string
}

// /health lives at root (not /api/v1) and returns JSON on both 200 and 503.
async function fetchHealth(): Promise<Health> {
  const res = await fetch("/health")
  return (await res.json()) as Health
}

export function HealthBadge() {
  const { data, isError } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
  })
  const up = !isError && data?.db === "up"
  return (
    <span className="flex items-center gap-2 text-xs text-muted-foreground">
      <span
        className={cn("size-2 rounded-full", up ? "bg-positive" : "bg-negative")}
      />
      {up ? "API connected" : "API unreachable"}
    </span>
  )
}

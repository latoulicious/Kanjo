import { useState } from "react"
import { iconNames, DynamicIcon, type IconName } from "lucide-react/dynamic"
import { X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// Shown before the user searches — common personal-finance buckets.
const COMMON: IconName[] = [
  "utensils", "shopping-cart", "house", "car", "fuel", "pill",
  "graduation-cap", "popcorn", "plane", "lightbulb", "smartphone", "shirt",
  "wallet", "gift", "dog", "wrench", "heart-pulse", "bus", "train-front",
  "baby", "dumbbell", "book", "coffee", "cake", "gamepad-2", "music",
  "wifi", "credit-card", "piggy-bank", "banknote",
]

// Cap rendered buttons: each DynamicIcon lazy-loads its own chunk, so a full
// 1986-icon grid would fire ~2000 imports. Search narrows; 60 is plenty.
// ponytail: hard cap, no pagination. Add "show more" if users hit it often.
const MAX = 60

export function IconPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (name: string) => void
}) {
  const [q, setQ] = useState("")
  const query = q.trim().toLowerCase()
  const names = (query
    ? iconNames.filter((n) => n.includes(query))
    : COMMON
  ).slice(0, MAX)

  return (
    <div className="space-y-2">
      <Input
        placeholder="Search icons…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="grid max-h-44 grid-cols-8 gap-1 overflow-y-auto rounded-md border border-border p-2">
        <button
          type="button"
          onClick={() => onChange("")}
          title="No icon"
          className={cn(
            "flex aspect-square items-center justify-center rounded text-muted-foreground hover:bg-accent",
            value === "" && "bg-primary text-primary-foreground",
          )}
        >
          <X className="size-4" />
        </button>
        {names.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            title={n}
            className={cn(
              "flex aspect-square items-center justify-center rounded hover:bg-accent",
              value === n && "bg-primary text-primary-foreground",
            )}
          >
            <DynamicIcon name={n} className="size-4" />
          </button>
        ))}
        {names.length === 0 && (
          <p className="col-span-8 py-2 text-center text-xs text-muted-foreground">
            No icons match “{q}”.
          </p>
        )}
      </div>
    </div>
  )
}

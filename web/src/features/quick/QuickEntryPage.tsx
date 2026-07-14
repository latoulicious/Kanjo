import { useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ApiError } from "@/lib/api"
import { formatAmount } from "@/lib/money"
import { useResourceList } from "@/lib/resources"
import { cn } from "@/lib/utils"
import { CategoryIcon } from "@/features/shared/CategoryIcon"
import { useCreateTransaction, useTransactions } from "@/features/transactions/hooks"
import { NONE, todayStr } from "@/features/transactions/form"
import type { Account, Category } from "@/types"

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/
const LAST_ACCOUNT = "kanjo.quick.account"
const LAST_CATEGORY = "kanjo.quick.category"

export function QuickEntryPage() {
  const accounts = useResourceList<Account>("accounts")
  const categories = useResourceList<Category>("categories")
  const recent = useTransactions({})
  const create = useCreateTransaction()

  const amountRef = useRef<HTMLInputElement>(null)
  const [direction, setDirection] = useState<"expense" | "income">("expense")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [occurredOn, setOccurredOn] = useState(todayStr())
  const [accountId, setAccountId] = useState(() => localStorage.getItem(LAST_ACCOUNT) ?? "")
  const [categoryId, setCategoryId] = useState(() => localStorage.getItem(LAST_CATEGORY) ?? NONE)

  async function save() {
    if (create.isPending) return
    if (!AMOUNT_RE.test(amount) || Number(amount) <= 0) {
      toast.error("Positive amount, up to 2 decimals")
      return
    }
    if (!accountId) {
      toast.error("Pick an account")
      return
    }
    try {
      await create.mutateAsync({
        occurred_on: occurredOn,
        description: description.trim(),
        direction,
        amount,
        account_id: Number(accountId),
        category_id: categoryId === NONE ? null : Number(categoryId),
        tags: [],
      })
      localStorage.setItem(LAST_ACCOUNT, accountId)
      localStorage.setItem(LAST_CATEGORY, categoryId)
      toast.success("Logged")
      setAmount("")
      setDescription("")
      setOccurredOn(todayStr())
      amountRef.current?.focus()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong")
    }
  }

  const categoryName = (id: number | null) =>
    categories.data?.find((c) => c.id === id)?.name ?? ""

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <div className="grid grid-cols-2 gap-2">
          {(["expense", "income"] as const).map((d) => (
            <Button
              key={d}
              type="button"
              variant={direction === d ? "default" : "outline"}
              onClick={() => setDirection(d)}
            >
              {d === "expense" ? "Expense" : "Income"}
            </Button>
          ))}
        </div>
        <Input
          ref={amountRef}
          inputMode="decimal"
          placeholder="0"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-14 text-center font-mono md:text-3xl text-3xl"
        />
        <div className="grid grid-cols-2 gap-2">
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.data?.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>
                  <span className="inline-flex items-center gap-2">
                    <CategoryIcon name={a.icon} />
                    {a.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No category</SelectItem>
              {categories.data?.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  <span className="inline-flex items-center gap-2">
                    <CategoryIcon name={c.icon} />
                    {c.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Input
            placeholder="What was this for? (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Input
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            className="w-36"
          />
        </div>
        <Button type="submit" size="lg" disabled={create.isPending}>
          Log {direction}
        </Button>
      </form>

      <section className="grid grid-cols-2 gap-2">
        {accounts.data?.map((a) => (
          <div key={a.id} className="rounded-md border border-border bg-card px-3 py-2">
            <p className="truncate text-xs text-muted-foreground">{a.name}</p>
            <p className="font-mono text-sm">{formatAmount(a.balance)}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Recent</h2>
        <ul className="divide-y divide-border rounded-md border border-border bg-card">
          {recent.data?.slice(0, 8).map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  {t.description || categoryName(t.category_id) || t.direction}
                </p>
                <p className="text-xs text-muted-foreground">{t.occurred_on}</p>
              </div>
              <span
                className={cn(
                  "font-mono text-sm",
                  t.is_inflow ? "text-emerald-500" : "text-foreground",
                )}
              >
                {t.is_inflow ? "+" : "−"}
                {formatAmount(t.amount)}
              </span>
            </li>
          ))}
          {recent.data?.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-muted-foreground">
              Nothing logged yet.
            </li>
          )}
        </ul>
      </section>
    </div>
  )
}

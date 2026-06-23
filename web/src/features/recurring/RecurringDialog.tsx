import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { ApiError } from "@/lib/api"
import { useResourceList } from "@/lib/resources"
import type { Account, Category, Recurring, RecurringInput } from "@/types"
import { CategoryIcon } from "@/features/shared/CategoryIcon"
import { NONE, amountField } from "@/features/transactions/form"
import { useCreateRecurring, useUpdateRecurring } from "./hooks"

const schema = z.object({
  description: z.string().max(500, "Max 500 characters"),
  direction: z.enum(["income", "expense"]),
  amount: amountField,
  account_id: z.string().min(1, "Account is required"),
  category_id: z.string(),
  day_of_month: z.coerce.number().int().min(1).max(31),
})
type FormValues = z.input<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule?: Recurring
}

export function RecurringDialog({ open, onOpenChange, rule }: Props) {
  const accounts = useResourceList<Account>("accounts")
  const categories = useResourceList<Category>("categories")
  const create = useCreateRecurring()
  const update = useUpdateRecurring()
  const editing = rule != null

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: "",
      direction: "expense",
      amount: "",
      account_id: "",
      category_id: NONE,
      day_of_month: 1,
    },
  })

  useEffect(() => {
    if (!open) return
    form.reset(
      rule
        ? {
            description: rule.description,
            direction: rule.direction,
            amount: rule.amount,
            account_id: String(rule.account_id),
            category_id: rule.category_id ? String(rule.category_id) : NONE,
            day_of_month: rule.day_of_month,
          }
        : {
            description: "",
            direction: "expense",
            amount: "",
            account_id: "",
            category_id: NONE,
            day_of_month: 1,
          },
    )
  }, [open, rule, form])

  async function onSubmit(v: FormValues) {
    const input: RecurringInput = {
      description: v.description.trim(),
      direction: v.direction,
      amount: v.amount,
      account_id: Number(v.account_id),
      category_id: v.category_id === NONE ? null : Number(v.category_id),
      day_of_month: Number(v.day_of_month),
    }
    try {
      if (rule) {
        await update.mutateAsync({ id: rule.id, input })
        toast.success("Recurring updated")
      } else {
        await create.mutateAsync(input)
        toast.success("Recurring created")
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong")
    }
  }

  const pending = create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit recurring" : "New recurring"}</DialogTitle>
          <DialogDescription>
            A saved template — surfaced on the dashboard when it's due to log.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="direction"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Direction</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="expense">Expense</SelectItem>
                        <SelectItem value="income">Income</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="decimal"
                        placeholder="0"
                        className="font-mono"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                      </FormControl>
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
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>None</SelectItem>
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
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="day_of_month"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Day of month</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        name={field.name}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        value={field.value as number}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="e.g. Game pass"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {editing ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

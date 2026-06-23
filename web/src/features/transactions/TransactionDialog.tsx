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
import type { Account, Category, Project, Transaction, TransactionInput } from "@/types"
import { CategoryIcon } from "@/features/shared/CategoryIcon"
import { useCreateTransaction, useUpdateTransaction } from "./hooks"
import { NONE, amountField, dateField, splitTags, todayStr } from "./form"

const schema = z.object({
  occurred_on: dateField,
  description: z.string().max(500, "Max 500 characters"),
  direction: z.enum(["income", "expense"]),
  amount: amountField,
  account_id: z.string().min(1, "Account is required"),
  category_id: z.string(),
  project_id: z.string(),
  tags: z.string(),
})
type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction?: Transaction
}

export function TransactionDialog({ open, onOpenChange, transaction }: Props) {
  const accounts = useResourceList<Account>("accounts")
  const categories = useResourceList<Category>("categories")
  const projects = useResourceList<Project>("projects")
  const create = useCreateTransaction()
  const update = useUpdateTransaction()
  const editing = transaction != null

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      occurred_on: "",
      description: "",
      direction: "expense",
      amount: "",
      account_id: "",
      category_id: NONE,
      project_id: NONE,
      tags: "",
    },
  })

  useEffect(() => {
    if (!open) return
    form.reset(
      transaction
        ? {
            occurred_on: transaction.occurred_on,
            description: transaction.description,
            direction: transaction.direction === "income" ? "income" : "expense",
            amount: transaction.amount,
            account_id: String(transaction.account_id),
            category_id: transaction.category_id
              ? String(transaction.category_id)
              : NONE,
            project_id: transaction.project_id
              ? String(transaction.project_id)
              : NONE,
            tags: transaction.tags.join(", "),
          }
        : {
            occurred_on: todayStr(),
            description: "",
            direction: "expense",
            amount: "",
            account_id: "",
            category_id: NONE,
            project_id: NONE,
            tags: "",
          },
    )
  }, [open, transaction, form])

  async function onSubmit(v: FormValues) {
    const input: TransactionInput = {
      occurred_on: v.occurred_on,
      description: v.description.trim(),
      direction: v.direction,
      amount: v.amount,
      account_id: Number(v.account_id),
      category_id: v.category_id === NONE ? null : Number(v.category_id),
      project_id: v.project_id === NONE ? null : Number(v.project_id),
      tags: splitTags(v.tags),
    }
    try {
      if (transaction) {
        await update.mutateAsync({ id: transaction.id, input })
        toast.success("Transaction updated")
      } else {
        await create.mutateAsync(input)
        toast.success("Transaction created")
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit transaction" : "New transaction"}
          </DialogTitle>
          <DialogDescription>
            One ledger entry — income or expense.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="occurred_on"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                name="project_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>None</SelectItem>
                        {projects.data?.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                      placeholder="What was this for?"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <FormControl>
                    <Input placeholder="comma, separated" {...field} />
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
              <Button
                type="submit"
                disabled={create.isPending || update.isPending}
              >
                {editing ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

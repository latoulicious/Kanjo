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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { ApiError } from "@/lib/api"
import { useResourceList } from "@/lib/resources"
import type { Account, Category, TransferInput } from "@/types"
import { CategoryIcon } from "@/features/shared/CategoryIcon"
import { useCreateTransfer } from "./hooks"
import { NONE, amountField, dateField, splitTags, todayStr } from "./form"

// Transfers are immutable (no edit) — this dialog only creates. A fee requires a
// fee category (mirrors the API: an uncategorized fee would skew burn reports).
const schema = z
  .object({
    occurred_on: dateField,
    description: z.string().max(500, "Max 500 characters"),
    from_account_id: z.string().min(1, "Source account is required"),
    to_account_id: z.string().min(1, "Destination account is required"),
    amount: amountField,
    fee: z.string(),
    fee_category_id: z.string(),
    tags: z.string(),
  })
  .refine((v) => v.from_account_id !== v.to_account_id, {
    path: ["to_account_id"],
    message: "Must differ from the source account",
  })
  .refine((v) => v.fee === "" || /^\d+(\.\d{1,2})?$/.test(v.fee), {
    path: ["fee"],
    message: "Positive amount, up to 2 decimals",
  })
  .refine((v) => v.fee === "" || v.fee_category_id !== NONE, {
    path: ["fee_category_id"],
    message: "Required when a fee is set",
  })
type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const blank: FormValues = {
  occurred_on: "",
  description: "",
  from_account_id: "",
  to_account_id: "",
  amount: "",
  fee: "",
  fee_category_id: NONE,
  tags: "",
}

export function TransferDialog({ open, onOpenChange }: Props) {
  const accounts = useResourceList<Account>("accounts")
  const categories = useResourceList<Category>("categories")
  const create = useCreateTransfer()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: blank,
  })

  useEffect(() => {
    if (open) form.reset({ ...blank, occurred_on: todayStr() })
  }, [open, form])

  async function onSubmit(v: FormValues) {
    const input: TransferInput = {
      occurred_on: v.occurred_on,
      description: v.description.trim(),
      from_account_id: Number(v.from_account_id),
      to_account_id: Number(v.to_account_id),
      amount: v.amount,
      tags: splitTags(v.tags),
    }
    if (v.fee) {
      input.fee = v.fee
      input.fee_category_id = Number(v.fee_category_id)
    }
    try {
      await create.mutateAsync(input)
      toast.success("Transfer created")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New transfer</DialogTitle>
          <DialogDescription>
            Move money between accounts. Transfers can't be edited — delete and
            recreate to change one.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="from_account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Source" />
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
                name="to_account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Destination" />
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
                name="fee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fee (optional)</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="decimal"
                        placeholder="0"
                        className="font-mono"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Charged to the source.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fee_category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fee category</FormLabel>
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
                    <FormDescription>Required when a fee is set.</FormDescription>
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
                    <Textarea rows={2} placeholder="What's this transfer?" {...field} />
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
              <Button type="submit" disabled={create.isPending}>
                Create transfer
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

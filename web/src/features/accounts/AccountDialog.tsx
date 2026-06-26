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
import { Switch } from "@/components/ui/switch"
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
import type { Account } from "@/types"
import { IconPicker } from "@/features/shared/IconPicker"
import { useCreateAccount, useUpdateAccount } from "./hooks"

// max 100 mirrors the API's name limit (account/service.go); target_amount
// rules mirror the category budget field (positive, up to 2 decimals, or blank).
const schema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100, "Max 100 characters"),
    is_liquid: z.boolean(),
    icon: z.string(),
    target_amount: z.string(),
  })
  .refine(
    (v) =>
      v.target_amount === "" ||
      (/^\d+(\.\d{1,2})?$/.test(v.target_amount) && Number(v.target_amount) > 0),
    { path: ["target_amount"], message: "Positive amount, up to 2 decimals" },
  )
type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  account?: Account
}

export function AccountDialog({ open, onOpenChange, account }: Props) {
  const create = useCreateAccount()
  const update = useUpdateAccount()
  const editing = account != null

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", is_liquid: true, icon: "", target_amount: "" },
  })

  // Load the edited row (or reset to blank) each time the dialog opens.
  useEffect(() => {
    if (open) {
      form.reset({
        name: account?.name ?? "",
        is_liquid: account?.is_liquid ?? true,
        icon: account?.icon ?? "",
        target_amount: account?.target_amount ?? "",
      })
    }
  }, [open, account, form])

  async function onSubmit(values: FormValues) {
    try {
      if (account) {
        await update.mutateAsync({ id: account.id, input: values })
        toast.success("Account updated")
      } else {
        await create.mutateAsync(values)
        toast.success("Account created")
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong")
    }
  }

  const pending = create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit account" : "New account"}</DialogTitle>
          <DialogDescription>
            A place money sits — a bank, cash, or a fund.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. BCA" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Icon</FormLabel>
                  <IconPicker value={field.value} onChange={field.onChange} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="is_liquid"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border border-border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Liquid</FormLabel>
                    <FormDescription>
                      Spendable now — counts toward runway.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="target_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Goal target</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="decimal"
                      placeholder="0"
                      className="font-mono"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Set a target to track this account as a savings goal. Blank = none.
                  </FormDescription>
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

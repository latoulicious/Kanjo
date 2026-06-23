import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ApiError } from "@/lib/api"
import { formatAmount } from "@/lib/money"
import { useResourceList } from "@/lib/resources"
import type { Account, Category, Recurring } from "@/types"
import { CategoryIcon } from "@/features/shared/CategoryIcon"
import { useRecurring, useDeleteRecurring } from "./hooks"
import { RecurringDialog } from "./RecurringDialog"

export function RecurringPage() {
  const { data: rules, isLoading, isError } = useRecurring()
  const accounts = useResourceList<Account>("accounts")
  const categories = useResourceList<Category>("categories")
  const del = useDeleteRecurring()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Recurring | undefined>()
  const [deleting, setDeleting] = useState<Recurring | undefined>()

  const accountById = useMemo(
    () => new Map((accounts.data ?? []).map((a) => [a.id, a])),
    [accounts.data],
  )
  const categoryById = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c])),
    [categories.data],
  )

  function openCreate() {
    setEditing(undefined)
    setDialogOpen(true)
  }
  function openEdit(rule: Recurring) {
    setEditing(rule)
    setDialogOpen(true)
  }

  async function confirmDelete() {
    if (!deleting) return
    try {
      await del.mutateAsync(deleting.id)
      toast.success("Recurring deleted")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Delete failed")
    } finally {
      setDeleting(undefined)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-medium">Recurring</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Saved templates the dashboard reminds you to log each cycle.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" /> New recurring
        </Button>
      </header>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Day</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <RowMessage>Loading…</RowMessage>}
            {isError && <RowMessage>Failed to load recurring.</RowMessage>}
            {rules?.length === 0 && <RowMessage>No recurring yet.</RowMessage>}
            {rules?.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell className="font-medium">
                  {rule.description || (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatAmount(rule.amount)}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <span className="inline-flex items-center gap-2">
                    <CategoryIcon name={accountById.get(rule.account_id)?.icon} />
                    {accountById.get(rule.account_id)?.name ??
                      `#${rule.account_id}`}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {rule.category_id != null ? (
                    <span className="inline-flex items-center gap-2">
                      <CategoryIcon
                        name={categoryById.get(rule.category_id)?.icon}
                      />
                      {categoryById.get(rule.category_id)?.name ??
                        `#${rule.category_id}`}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  Day {rule.day_of_month}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Edit recurring"
                      onClick={() => openEdit(rule)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete recurring"
                      onClick={() => setDeleting(rule)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <RecurringDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rule={editing}
      />

      <AlertDialog
        open={deleting != null}
        onOpenChange={(o) => !o && setDeleting(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete “{deleting?.description || "recurring"}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This can't be undone. Logged transactions stay; only the template is
              removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={del.isPending}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function RowMessage({ children }: { children: ReactNode }) {
  return (
    <TableRow>
      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
        {children}
      </TableCell>
    </TableRow>
  )
}

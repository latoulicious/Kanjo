import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import { Plus, ArrowLeftRight, Pencil, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { useResourceList } from "@/lib/resources"
import { formatAmount } from "@/lib/money"
import { cn } from "@/lib/utils"
import type {
  Account,
  Category,
  Project,
  Transaction,
  TransactionFilter,
} from "@/types"
import {
  useTransactions,
  useDeleteTransaction,
  useDeleteTransfer,
} from "./hooks"
import { TransactionDialog } from "./TransactionDialog"
import { TransferDialog } from "./TransferDialog"

const ALL = "all"

export function LedgerPage() {
  const [filter, setFilter] = useState<TransactionFilter>({})
  const { data: txs, isLoading, isError } = useTransactions(filter)
  const accounts = useResourceList<Account>("accounts")
  const categories = useResourceList<Category>("categories")
  const projects = useResourceList<Project>("projects")

  const accountName = useMemo(
    () => new Map((accounts.data ?? []).map((a) => [a.id, a.name])),
    [accounts.data],
  )
  const categoryName = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c.name])),
    [categories.data],
  )
  const projectName = useMemo(
    () => new Map((projects.data ?? []).map((p) => [p.id, p.name])),
    [projects.data],
  )

  const [txOpen, setTxOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | undefined>()
  const [deleting, setDeleting] = useState<Transaction | undefined>()
  const delTx = useDeleteTransaction()
  const delTransfer = useDeleteTransfer()
  const deletePending = delTx.isPending || delTransfer.isPending

  function openNew() {
    setEditing(undefined)
    setTxOpen(true)
  }
  function openEdit(tx: Transaction) {
    setEditing(tx)
    setTxOpen(true)
  }

  async function confirmDelete() {
    if (!deleting) return
    try {
      if (deleting.transfer_group_id) {
        await delTransfer.mutateAsync(deleting.transfer_group_id)
      } else {
        await delTx.mutateAsync(deleting.id)
      }
      toast.success("Deleted")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Delete failed")
    } finally {
      setDeleting(undefined)
    }
  }

  const hasFilter =
    filter.from != null ||
    filter.to != null ||
    filter.account_id != null ||
    filter.category_id != null ||
    filter.project_id != null

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-medium">Ledger</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every entry. The atomic unit everything else is derived from.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setTransferOpen(true)}>
            <ArrowLeftRight className="size-4" /> New transfer
          </Button>
          <Button onClick={openNew}>
            <Plus className="size-4" /> New transaction
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <FilterField label="From">
          <Input
            type="date"
            className="w-full sm:w-40"
            value={filter.from ?? ""}
            onChange={(e) =>
              setFilter((f) => ({ ...f, from: e.target.value || undefined }))
            }
          />
        </FilterField>
        <FilterField label="To">
          <Input
            type="date"
            className="w-full sm:w-40"
            value={filter.to ?? ""}
            onChange={(e) =>
              setFilter((f) => ({ ...f, to: e.target.value || undefined }))
            }
          />
        </FilterField>
        <FilterSelect
          label="Account"
          value={filter.account_id}
          onChange={(id) => setFilter((f) => ({ ...f, account_id: id }))}
          options={accounts.data}
        />
        <FilterSelect
          label="Category"
          value={filter.category_id}
          onChange={(id) => setFilter((f) => ({ ...f, category_id: id }))}
          options={categories.data}
        />
        <FilterSelect
          label="Project"
          value={filter.project_id}
          onChange={(id) => setFilter((f) => ({ ...f, project_id: id }))}
          options={projects.data}
        />
        {hasFilter && (
          <Button variant="ghost" size="sm" onClick={() => setFilter({})}>
            <X className="size-4" /> Clear
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="hidden lg:table-cell">Project</TableHead>
              <TableHead className="hidden lg:table-cell">Tags</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <RowMessage>Loading…</RowMessage>}
            {isError && <RowMessage>Failed to load transactions.</RowMessage>}
            {txs?.length === 0 && <RowMessage>No transactions yet.</RowMessage>}
            {txs?.map((tx) => {
              const isTransfer = tx.transfer_group_id != null
              return (
                <TableRow key={tx.id}>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {tx.occurred_on}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">
                      {tx.description || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </span>
                    {isTransfer && (
                      <Badge variant="outline" className="ml-2 align-middle">
                        transfer
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={cn(
                        "font-mono tabular-nums",
                        tx.is_inflow ? "text-positive" : "text-negative",
                      )}
                    >
                      {tx.is_inflow ? "+" : "−"}
                      {formatAmount(tx.amount)}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {accountName.get(tx.account_id) ?? `#${tx.account_id}`}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {tx.category_id != null
                      ? (categoryName.get(tx.category_id) ?? `#${tx.category_id}`)
                      : "—"}
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                    {tx.project_id != null
                      ? (projectName.get(tx.project_id) ?? `#${tx.project_id}`)
                      : "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {tx.tags.map((t) => (
                        <Badge key={t} variant="secondary">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {!isTransfer && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Edit transaction"
                          onClick={() => openEdit(tx)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete transaction"
                        onClick={() => setDeleting(tx)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <TransactionDialog
        open={txOpen}
        onOpenChange={setTxOpen}
        transaction={editing}
      />
      <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} />

      <AlertDialog
        open={deleting != null}
        onOpenChange={(o) => !o && setDeleting(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.transfer_group_id
                ? "This removes the entire transfer — both legs and any fee."
                : "This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deletePending}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function FilterField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="flex w-full flex-col gap-1 text-xs text-muted-foreground sm:w-auto">
      {label}
      {children}
    </label>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: number | undefined
  onChange: (id: number | undefined) => void
  options: { id: number; name: string }[] | undefined
}) {
  return (
    <FilterField label={label}>
      <Select
        value={value != null ? String(value) : ALL}
        onValueChange={(v) => onChange(v === ALL ? undefined : Number(v))}
      >
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {options?.map((o) => (
            <SelectItem key={o.id} value={String(o.id)}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  )
}

function RowMessage({ children }: { children: ReactNode }) {
  return (
    <TableRow>
      <TableCell
        colSpan={8}
        className="py-8 text-center text-muted-foreground"
      >
        {children}
      </TableCell>
    </TableRow>
  )
}

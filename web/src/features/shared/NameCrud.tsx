import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { api, ApiError } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { CategoryIcon } from "./CategoryIcon"
import { IconPicker } from "./IconPicker"

// Categories and projects are identical name buckets sharing one manager;
// categories opt into the icon picker via withIcon. Accounts stays bespoke (is_liquid).
interface NamedRow {
  id: number
  name: string
  icon?: string
  created_at: string
}

interface Props {
  path: string // REST resource segment, e.g. "categories"
  title: string
  subtitle: string
  singular: string // lowercased noun, e.g. "category"
  placeholder: string
  withIcon?: boolean // show the lucide icon picker + render icons in the list
}

// icon rides along for every bucket; the API ignores unknown JSON fields, so
// projects harmlessly post icon:"". max 100 mirrors the API name limit.
const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Max 100 characters"),
  icon: z.string(),
})
type FormValues = z.infer<typeof schema>

export function NameCrud({
  path,
  title,
  subtitle,
  singular,
  placeholder,
  withIcon = false,
}: Props) {
  const qc = useQueryClient()
  const key = [path]
  const invalidate = () => qc.invalidateQueries({ queryKey: key })

  const { data: rows, isLoading, isError } = useQuery({
    queryKey: key,
    queryFn: () => api.get<NamedRow[]>(`/${path}`),
  })
  const create = useMutation({
    mutationFn: (input: FormValues) => api.post<NamedRow>(`/${path}`, input),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: FormValues }) =>
      api.put<NamedRow>(`/${path}/${id}`, input),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/${path}/${id}`),
    onSuccess: invalidate,
  })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<NamedRow | undefined>()
  const [deleting, setDeleting] = useState<NamedRow | undefined>()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", icon: "" },
  })
  useEffect(() => {
    if (dialogOpen)
      form.reset({ name: editing?.name ?? "", icon: editing?.icon ?? "" })
  }, [dialogOpen, editing, form])

  async function onSubmit(values: FormValues) {
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, input: values })
        toast.success(`Updated ${singular}`)
      } else {
        await create.mutateAsync(values)
        toast.success(`Created ${singular}`)
      }
      setDialogOpen(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong")
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    try {
      await remove.mutateAsync(deleting.id)
      toast.success(`Deleted ${singular}`)
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
          <h1 className="font-serif text-2xl font-medium">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="size-4" /> New {singular}
        </Button>
      </header>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <RowMessage>Loading…</RowMessage>}
            {isError && <RowMessage>Failed to load.</RowMessage>}
            {rows?.length === 0 && <RowMessage>Nothing here yet.</RowMessage>}
            {rows?.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  <span className="inline-flex items-center gap-2">
                    {withIcon && (
                      <CategoryIcon
                        name={row.icon}
                        className="size-4 text-muted-foreground"
                      />
                    )}
                    {row.name}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${singular}`}
                      onClick={() => {
                        setEditing(row)
                        setDialogOpen(true)
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${singular}`}
                      onClick={() => setDeleting(row)}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit ${singular}` : `New ${singular}`}
            </DialogTitle>
            <DialogDescription>{subtitle}</DialogDescription>
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
                      <Input placeholder={placeholder} autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {withIcon && (
                <FormField
                  control={form.control}
                  name="icon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Icon</FormLabel>
                      <IconPicker
                        value={field.value}
                        onChange={field.onChange}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
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

      <AlertDialog
        open={deleting != null}
        onOpenChange={(o) => !o && setDeleting(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This can't be undone. Transactions keep their history — they just
              lose this {singular}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={remove.isPending}>
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
      <TableCell
        colSpan={2}
        className="py-8 text-center text-muted-foreground"
      >
        {children}
      </TableCell>
    </TableRow>
  )
}

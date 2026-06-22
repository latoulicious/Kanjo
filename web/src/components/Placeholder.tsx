export function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <h1 className="font-serif text-2xl font-medium">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Coming in a later slice.
      </p>
    </div>
  )
}

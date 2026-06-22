import { DynamicIcon, type IconName } from "lucide-react/dynamic"

// Renders a category's lucide icon by stored name; nothing when empty. Names
// come from IconPicker (always valid lucide names), so no fallback needed.
export function CategoryIcon({
  name,
  className = "size-4",
}: {
  name?: string
  className?: string
}) {
  if (!name) return null
  return <DynamicIcon name={name as IconName} className={className} />
}

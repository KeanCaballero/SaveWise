import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card/50 px-6 py-14 text-center">
      {Icon ? (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
          <Icon className="h-7 w-7 text-muted-foreground" />
        </div>
      ) : null}
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {actionLabel ? (
        <Button onClick={onAction} className="mt-5">
          <Plus /> {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}

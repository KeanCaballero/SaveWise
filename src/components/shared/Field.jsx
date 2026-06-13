import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/** Form field wrapper: label + control + validation error. */
export default function Field({ label, error, hint, className, children }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? <Label>{label}</Label> : null}
      {children}
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

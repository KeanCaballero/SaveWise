import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

/** Large centered PIN field (4–6 digits, masked). */
const PinInput = forwardRef(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="password"
    inputMode="numeric"
    autoComplete="off"
    pattern="[0-9]*"
    maxLength={6}
    placeholder="••••"
    className={cn(
      'flex h-14 w-full rounded-xl border border-input bg-card text-center text-2xl font-bold tracking-[0.6em] shadow-sm placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      className
    )}
    {...props}
  />
))
PinInput.displayName = 'PinInput'

export default PinInput

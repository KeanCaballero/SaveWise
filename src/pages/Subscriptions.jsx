import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { CalendarClock, Pencil, Plus, Repeat, Trash2 } from 'lucide-react'
import { useProfile } from '@/context/ProfileContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import { listSubscriptions, createSubscription, updateSubscription, deleteSubscription } from '@/services/subscriptions'
import { cn, formatMoney, formatDate, dueInfo, monthlyCost, notifyDataChanged } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import StatCard from '@/components/shared/StatCard'
import EmptyState from '@/components/shared/EmptyState'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import Field from '@/components/shared/Field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const schema = z.object({
  name: z.string().trim().min(1, 'Name this subscription').max(60),
  cost: z.coerce.number({ invalid_type_error: 'Enter a cost' }).positive('Must be greater than zero'),
  billing_cycle: z.enum(['weekly', 'monthly', 'yearly']),
  renewal_date: z.string().min(1, 'Pick the next renewal date'),
})

function SubForm({ open, onOpenChange, profileId, editing, onSaved }) {
  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', cost: '', billing_cycle: 'monthly', renewal_date: '' },
    values: editing
      ? { name: editing.name, cost: Number(editing.cost), billing_cycle: editing.billing_cycle, renewal_date: editing.renewal_date }
      : undefined,
  })

  const onSubmit = async (data) => {
    try {
      if (editing) await updateSubscription(editing.id, data)
      else await createSubscription(profileId, data)
      toast.success(editing ? 'Subscription updated' : 'Subscription added')
      onOpenChange(false)
      reset()
      onSaved()
      notifyDataChanged()
    } catch (e) {
      console.error(e)
      toast.error('Could not save subscription', { description: e.message })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{editing ? 'Edit subscription' : 'Add subscription'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Name" error={errors.name?.message}>
            <Input placeholder="e.g. Netflix" autoFocus list="sub-suggestions" {...register('name')} />
            <datalist id="sub-suggestions">
              {['Netflix', 'Spotify', 'ChatGPT', 'Canva', 'YouTube Premium', 'iCloud'].map((s) => <option key={s} value={s} />)}
            </datalist>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cost" error={errors.cost?.message}>
              <Input type="number" step="any" min="0" inputMode="decimal" placeholder="0.00" {...register('cost')} />
            </Field>
            <Field label="Billing cycle">
              <Controller
                name="billing_cycle"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>
          <Field label="Next renewal" error={errors.renewal_date?.message}>
            <Input type="date" {...register('renewal_date')} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{editing ? 'Save' : 'Add'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function Subscriptions() {
  const { profile, currency } = useProfile()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const { data: subs, loading, refresh } = useAsyncData(() => listSubscriptions(profile.id), [profile.id])
  const all = subs || []
  const active = all.filter((s) => s.active !== false)
  const monthlyTotal = active.reduce((a, s) => a + monthlyCost(s), 0)
  const next = [...active].sort((a, b) => (a.renewal_date || '').localeCompare(b.renewal_date || ''))[0]

  const toggleActive = async (sub) => {
    await updateSubscription(sub.id, { active: !(sub.active !== false) })
    toast.success(sub.active !== false ? `${sub.name} paused` : `${sub.name} resumed`)
    refresh()
    notifyDataChanged()
  }

  return (
    <div>
      <PageHeader title="Subscriptions" description="The quiet little charges, all in one place.">
        <Button onClick={() => { setEditing(null); setFormOpen(true) }}><Plus /> Add</Button>
      </PageHeader>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Monthly total" value={formatMoney(monthlyTotal, currency)} icon={Repeat} tone="violet" sub={`≈ ${formatMoney(monthlyTotal * 12, currency)} per year`} />
        <StatCard label="Active" value={active.length} icon={CalendarClock} tone="blue" sub={`${all.length - active.length} paused`} />
        <StatCard label="Next renewal" value={next ? next.name : '—'} icon={CalendarClock} tone="amber" sub={next ? dueInfo(next.renewal_date).label.replace('Due', 'Renews') : 'Nothing scheduled'} />
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : all.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No subscriptions tracked"
          description="Netflix, Spotify, ChatGPT… add them and see the real monthly damage."
          actionLabel="Add subscription"
          onAction={() => { setEditing(null); setFormOpen(true) }}
        />
      ) : (
        <Card className="divide-y overflow-hidden">
          {all.map((sub) => {
            const due = dueInfo(sub.renewal_date)
            const isActive = sub.active !== false
            return (
              <div key={sub.id} className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-accent/50 sm:px-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-base font-bold text-violet-600 dark:text-violet-400">
                  {sub.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate text-sm font-medium', !isActive && 'text-muted-foreground line-through')}>{sub.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatMoney(sub.cost, currency)} / {sub.billing_cycle.replace('ly', '')} · renews {formatDate(sub.renewal_date)}
                  </p>
                </div>
                {isActive && due.days !== null && due.days <= 3 && due.days >= 0 ? (
                  <Badge variant="warning">{due.days === 0 ? 'Renews today' : `Renews in ${due.days}d`}</Badge>
                ) : null}
                <p className="hidden text-sm font-bold tabular-nums sm:block">{formatMoney(monthlyCost(sub), currency)}<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
                <Switch checked={isActive} onCheckedChange={() => toggleActive(sub)} aria-label="Active" />
                <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Edit" onClick={() => { setEditing(sub); setFormOpen(true) }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label="Delete" onClick={() => setDeleting(sub)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            )
          })}
        </Card>
      )}

      <SubForm open={formOpen} onOpenChange={setFormOpen} profileId={profile.id} editing={editing} onSaved={refresh} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="Removed from tracking — remember to cancel the actual subscription too!"
        onConfirm={async () => {
          await deleteSubscription(deleting.id)
          toast.success('Subscription deleted')
          setDeleting(null)
          refresh()
          notifyDataChanged()
        }}
      />
    </div>
  )
}

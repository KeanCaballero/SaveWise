import { useState } from 'react'
import { differenceInCalendarDays, differenceInCalendarMonths } from 'date-fns'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { CalendarDays, PartyPopper, Pencil, PiggyBank, Plus, Trash2 } from 'lucide-react'
import { useProfile } from '@/context/ProfileContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import { listGoals, createGoal, updateGoal, deleteGoal, addFunds } from '@/services/goals'
import { evaluateAchievements } from '@/lib/achievements'
import { runNotificationScan } from '@/lib/notify'
import { cn, formatMoney, formatDate, pct, sum, toDate, notifyDataChanged } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import StatCard from '@/components/shared/StatCard'
import EmptyState from '@/components/shared/EmptyState'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import Field from '@/components/shared/Field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const PRIORITY_BADGES = { high: 'destructive', medium: 'warning', low: 'info' }

const schema = z.object({
  name: z.string().trim().min(1, 'Name your goal').max(60),
  target_amount: z.coerce.number({ invalid_type_error: 'Enter a target' }).positive('Must be greater than zero'),
  current_amount: z.coerce.number({ invalid_type_error: 'Enter an amount' }).min(0, 'Cannot be negative'),
  target_date: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']),
})

function GoalForm({ open, onOpenChange, profileId, editing, onSaved }) {
  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', target_amount: '', current_amount: 0, target_date: '', priority: 'medium' },
    values: editing
      ? { name: editing.name, target_amount: Number(editing.target_amount), current_amount: Number(editing.current_amount), target_date: editing.target_date || '', priority: editing.priority }
      : undefined,
  })

  const onSubmit = async (data) => {
    try {
      const payload = {
        ...data,
        target_date: data.target_date || null,
        completed_at: data.current_amount >= data.target_amount ? new Date().toISOString() : null,
      }
      if (editing) await updateGoal(editing.id, payload)
      else await createGoal(profileId, payload)
      toast.success(editing ? 'Goal updated' : 'Goal created')
      onOpenChange(false)
      reset()
      onSaved()
      notifyDataChanged()
    } catch (e) {
      console.error(e)
      toast.error('Could not save goal', { description: e.message })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit goal' : 'New savings goal'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Goal name" error={errors.name?.message}>
            <Input placeholder="e.g. Gaming PC" autoFocus {...register('name')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target amount" error={errors.target_amount?.message}>
              <Input type="number" step="any" min="0" placeholder="50000" {...register('target_amount')} />
            </Field>
            <Field label="Starting amount" error={errors.current_amount?.message}>
              <Input type="number" step="any" min="0" placeholder="0" {...register('current_amount')} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target date" hint="Optional">
              <Input type="date" {...register('target_date')} />
            </Field>
            <Field label="Priority">
              <Controller
                name="priority"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{editing ? 'Save changes' : 'Create goal'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddFundsDialog({ goal, currency, onOpenChange, profileId, onSaved }) {
  const [amount, setAmount] = useState('')
  if (!goal) return null
  const remaining = Number(goal.target_amount) - Number(goal.current_amount)

  const submit = async (e) => {
    e.preventDefault()
    const n = Number(amount)
    if (!n || n <= 0) return
    try {
      const updated = await addFunds(goal, n)
      if (updated.completed_at && !goal.completed_at) {
        toast.success(`🎉 "${goal.name}" is fully funded!`)
      } else {
        toast.success(`Added ${formatMoney(n, currency)} to "${goal.name}"`)
      }
      onOpenChange(false)
      setAmount('')
      onSaved()
      await runNotificationScan(profileId, currency)
      const unlocked = await evaluateAchievements(profileId)
      unlocked.forEach((a) => toast(`${a.icon} Achievement unlocked: ${a.title}`))
      notifyDataChanged()
    } catch (err) {
      console.error(err)
      toast.error('Could not add funds', { description: err.message })
    }
  }

  return (
    <Dialog open={Boolean(goal)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add funds — {goal.name}</DialogTitle>
          <DialogDescription>{formatMoney(remaining, currency)} to go.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Input type="number" step="any" min="0" inputMode="decimal" placeholder="0.00" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div className="flex gap-2">
            {[500, 1000, 5000].map((v) => (
              <Button key={v} type="button" variant="secondary" size="sm" className="flex-1" onClick={() => setAmount(String(v))}>
                +{formatMoney(v, currency)}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full" disabled={!Number(amount)}>Add funds</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function GoalCard({ goal, currency, onEdit, onDelete, onAddFunds }) {
  const target = Number(goal.target_amount)
  const current = Number(goal.current_amount)
  const progress = pct(current, target)
  const remaining = Math.max(0, target - current)
  const done = Boolean(goal.completed_at) || current >= target

  let weekly = null
  let monthly = null
  if (!done && goal.target_date) {
    const days = Math.max(1, differenceInCalendarDays(toDate(goal.target_date), new Date()))
    weekly = remaining / Math.max(1, days / 7)
    monthly = remaining / Math.max(1, differenceInCalendarMonths(toDate(goal.target_date), new Date()) || 1)
  }

  return (
    <Card className={cn('animate-fade-in-up', done && 'border-emerald-300 dark:border-emerald-800')}>
      <CardContent className="p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-semibold">
              <span className="truncate">{goal.name}</span>
              {done ? <Badge variant="success"><PartyPopper className="h-3 w-3" /> Completed</Badge> : <Badge variant={PRIORITY_BADGES[goal.priority]}>{goal.priority}</Badge>}
            </p>
            {goal.target_date ? (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarDays className="h-3 w-3" /> Target: {formatDate(goal.target_date)}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Edit" onClick={() => onEdit(goal)}><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label="Delete" onClick={() => onDelete(goal)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="mb-1.5 flex items-baseline justify-between">
          <p className="text-lg font-bold tabular-nums">{formatMoney(current, currency)}</p>
          <p className="text-sm tabular-nums text-muted-foreground">of {formatMoney(target, currency)}</p>
        </div>
        <Progress value={progress} className="h-3" indicatorClassName={done ? 'bg-emerald-500' : undefined} />
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{progress}%</span>
          {!done ? <span className="tabular-nums">{formatMoney(remaining, currency)} remaining</span> : <span>Goal reached 🎉</span>}
        </div>

        {!done && (weekly || monthly) ? (
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-secondary/60 p-3 text-center">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Weekly</p>
              <p className="text-sm font-bold tabular-nums">{formatMoney(weekly, currency)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Monthly</p>
              <p className="text-sm font-bold tabular-nums">{formatMoney(monthly, currency)}</p>
            </div>
          </div>
        ) : null}

        {!done ? (
          <Button className="mt-4 w-full" variant="secondary" onClick={() => onAddFunds(goal)}>
            <PiggyBank /> Add funds
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default function Savings() {
  const { profile, currency } = useProfile()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [funding, setFunding] = useState(null)

  const { data: goals, loading, refresh } = useAsyncData(() => listGoals(profile.id), [profile.id])
  const active = (goals || []).filter((g) => !g.completed_at && Number(g.current_amount) < Number(g.target_amount))
  const completed = (goals || []).filter((g) => g.completed_at || Number(g.current_amount) >= Number(g.target_amount))
  const totalSaved = sum(goals || [], 'current_amount')
  const totalTarget = sum(goals || [], 'target_amount')

  return (
    <div>
      <PageHeader title="Savings Goals" description="Name it, fund it, reach it.">
        <Button onClick={() => { setEditing(null); setFormOpen(true) }}><Plus /> New goal</Button>
      </PageHeader>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total saved" value={formatMoney(totalSaved, currency)} icon={PiggyBank} tone="primary" />
        <StatCard label="Combined target" value={formatMoney(totalTarget, currency)} icon={CalendarDays} tone="blue" />
        <StatCard label="Goals completed" value={`${completed.length} / ${(goals || []).length}`} icon={PartyPopper} tone="violet" />
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64" />)}</div>
      ) : (goals || []).length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="No savings goals yet"
          description="Whether it's an emergency fund or a gaming PC — give your money a mission."
          actionLabel="Create goal"
          onAction={() => { setEditing(null); setFormOpen(true) }}
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {active.map((g) => (
              <GoalCard key={g.id} goal={g} currency={currency} onEdit={(x) => { setEditing(x); setFormOpen(true) }} onDelete={setDeleting} onAddFunds={setFunding} />
            ))}
          </div>
          {completed.length > 0 ? (
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Completed</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {completed.map((g) => (
                  <GoalCard key={g.id} goal={g} currency={currency} onEdit={(x) => { setEditing(x); setFormOpen(true) }} onDelete={setDeleting} onAddFunds={setFunding} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <GoalForm open={formOpen} onOpenChange={setFormOpen} profileId={profile.id} editing={editing} onSaved={refresh} />
      <AddFundsDialog goal={funding} currency={currency} profileId={profile.id} onOpenChange={(o) => !o && setFunding(null)} onSaved={refresh} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete "${deleting?.name}"?`}
        description="The saved amount is only a tracker — no money moves."
        onConfirm={async () => {
          await deleteGoal(deleting.id)
          toast.success('Goal deleted')
          setDeleting(null)
          refresh()
        }}
      />
    </div>
  )
}

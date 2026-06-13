import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Check, HandCoins, Pencil, Plus, Trash2, TrendingDown, TrendingUp, Undo2 } from 'lucide-react'
import { useProfile } from '@/context/ProfileContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import { listLoans, createLoan, updateLoan, deleteLoan } from '@/services/loans'
import { evaluateAchievements } from '@/lib/achievements'
import { cn, formatMoney, dueInfo, sum, todayISO, notifyDataChanged } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import StatCard from '@/components/shared/StatCard'
import EmptyState from '@/components/shared/EmptyState'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import Field from '@/components/shared/Field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const STATUS_BADGES = { pending: 'warning', paid: 'success', overdue: 'destructive' }

const schema = z.object({
  person_name: z.string().trim().min(1, 'Who is this with?').max(60),
  amount: z.coerce.number({ invalid_type_error: 'Enter an amount' }).positive('Must be greater than zero'),
  due_date: z.string().optional(),
  notes: z.string().max(200).optional(),
})

function LoanForm({ open, onOpenChange, profileId, kind, editing, onSaved }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { person_name: '', amount: '', due_date: '', notes: '' },
    values: editing
      ? { person_name: editing.person_name, amount: Number(editing.amount), due_date: editing.due_date || '', notes: editing.notes || '' }
      : undefined,
  })

  const onSubmit = async (data) => {
    try {
      const payload = { ...data, due_date: data.due_date || null, notes: data.notes || null }
      if (editing) await updateLoan(editing.id, payload)
      else await createLoan(profileId, { ...payload, kind, status: 'pending' })
      toast.success(editing ? 'Loan updated' : 'Loan added')
      onOpenChange(false)
      reset()
      onSaved()
      notifyDataChanged()
    } catch (e) {
      console.error(e)
      toast.error('Could not save loan', { description: e.message })
    }
  }

  const title = editing
    ? 'Edit loan'
    : kind === 'debt' ? 'Add debt (you owe)' : 'Add receivable (owed to you)'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Person" error={errors.person_name?.message}>
            <Input placeholder="e.g. Carlos" autoFocus {...register('person_name')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount" error={errors.amount?.message}>
              <Input type="number" step="any" min="0" inputMode="decimal" placeholder="0.00" {...register('amount')} />
            </Field>
            <Field label="Due date" hint="Optional">
              <Input type="date" min={editing ? undefined : todayISO()} {...register('due_date')} />
            </Field>
          </div>
          <Field label="Notes" hint="Optional">
            <Textarea placeholder="What's this for?" {...register('notes')} />
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

function LoanRow({ loan, currency, onTogglePaid, onEdit, onDelete }) {
  const due = dueInfo(loan.due_date)
  const paid = loan.status === 'paid'
  return (
    <div className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-accent/50 sm:px-5">
      <div className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
        loan.kind === 'debt' ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
      )}>
        {loan.kind === 'debt' ? <TrendingDown className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-medium', paid && 'text-muted-foreground line-through')}>{loan.person_name}</p>
        <p className="truncate text-xs text-muted-foreground">{loan.notes || (loan.kind === 'debt' ? 'You owe' : 'Owes you')}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <p className={cn('text-sm font-bold tabular-nums', paid && 'text-muted-foreground line-through')}>{formatMoney(loan.amount, currency)}</p>
        <Badge variant={STATUS_BADGES[loan.status]}>{paid ? 'Paid' : due.days !== null && due.days < 0 ? 'Overdue' : due.label}</Badge>
      </div>
      <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={paid ? 'Mark unpaid' : 'Mark paid'} title={paid ? 'Mark unpaid' : 'Mark paid'} onClick={() => onTogglePaid(loan)}>
          {paid ? <Undo2 className="h-4 w-4" /> : <Check className="h-4 w-4 text-emerald-600" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Edit" onClick={() => onEdit(loan)}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label="Delete" onClick={() => onDelete(loan)}><Trash2 className="h-4 w-4" /></Button>
      </div>
    </div>
  )
}

export default function Loans() {
  const { profile, currency } = useProfile()
  const [tab, setTab] = useState('debt')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const { data: loans, loading, refresh } = useAsyncData(() => listLoans(profile.id), [profile.id])
  const all = loans || []
  const debts = all.filter((l) => l.kind === 'debt')
  const receivables = all.filter((l) => l.kind === 'receivable')
  const rows = tab === 'debt' ? debts : receivables
  const open = rows.filter((l) => l.status !== 'paid')
  const settled = rows.filter((l) => l.status === 'paid')
  const totalOwed = sum(debts.filter((l) => l.status !== 'paid'))
  const totalReceivable = sum(receivables.filter((l) => l.status !== 'paid'))
  const overdueCount = all.filter((l) => l.status === 'overdue').length

  const togglePaid = async (loan) => {
    const next = loan.status === 'paid' ? 'pending' : 'paid'
    await updateLoan(loan.id, { status: next })
    toast.success(next === 'paid' ? `Marked ${loan.person_name}'s loan as paid` : 'Marked as pending')
    refresh()
    if (next === 'paid') {
      const unlocked = await evaluateAchievements(profile.id)
      unlocked.forEach((a) => toast(`${a.icon} Achievement unlocked: ${a.title}`))
    }
    notifyDataChanged()
  }

  return (
    <div>
      <PageHeader title="Loan Manager" description="Debts you owe and money owed to you.">
        <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
          <Plus /> {tab === 'debt' ? 'Add debt' : 'Add receivable'}
        </Button>
      </PageHeader>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="You owe" value={formatMoney(totalOwed, currency)} icon={TrendingDown} tone="red" sub={`${debts.filter((l) => l.status !== 'paid').length} open`} />
        <StatCard label="Owed to you" value={formatMoney(totalReceivable, currency)} icon={TrendingUp} tone="primary" sub={`${receivables.filter((l) => l.status !== 'paid').length} open`} />
        <StatCard label="Overdue" value={overdueCount} icon={HandCoins} tone={overdueCount > 0 ? 'amber' : 'default'} sub="Across both lists" />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="debt">Debts ({debts.length})</TabsTrigger>
          <TabsTrigger value="receivable">Receivables ({receivables.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title={tab === 'debt' ? 'No debts — nice!' : 'No receivables'}
          description={tab === 'debt' ? 'Track anything you borrow so nothing sneaks up on you.' : 'Lent money to someone? Track it here so it comes back.'}
          actionLabel={tab === 'debt' ? 'Add debt' : 'Add receivable'}
          onAction={() => { setEditing(null); setFormOpen(true) }}
        />
      ) : (
        <div className="space-y-4">
          <Card className="divide-y overflow-hidden">
            {open.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-muted-foreground">Everything here is settled 🎉</p>
            ) : (
              open.map((l) => (
                <LoanRow key={l.id} loan={l} currency={currency} onTogglePaid={togglePaid} onEdit={(x) => { setEditing(x); setFormOpen(true) }} onDelete={setDeleting} />
              ))
            )}
          </Card>
          {settled.length > 0 ? (
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">History</h2>
              <Card className="divide-y overflow-hidden">
                {settled.map((l) => (
                  <LoanRow key={l.id} loan={l} currency={currency} onTogglePaid={togglePaid} onEdit={(x) => { setEditing(x); setFormOpen(true) }} onDelete={setDeleting} />
                ))}
              </Card>
            </div>
          ) : null}
        </div>
      )}

      <LoanForm open={formOpen} onOpenChange={setFormOpen} profileId={profile.id} kind={tab} editing={editing} onSaved={refresh} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete loan with ${deleting?.person_name}?`}
        description="This removes it from your history too."
        onConfirm={async () => {
          await deleteLoan(deleting.id)
          toast.success('Loan deleted')
          setDeleting(null)
          refresh()
          notifyDataChanged()
        }}
      />
    </div>
  )
}

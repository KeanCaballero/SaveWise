import { useState } from 'react'
import { format } from 'date-fns'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Check, Pencil, Plus, ReceiptText, Trash2, Undo2, Zap } from 'lucide-react'
import { useProfile } from '@/context/ProfileContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import { listBills, createBill, updateBill, deleteBill } from '@/services/bills'
import { cn, formatMoney, dueInfo, sum, notifyDataChanged } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import StatCard from '@/components/shared/StatCard'
import EmptyState from '@/components/shared/EmptyState'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import Field from '@/components/shared/Field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const STATUS_BADGES = { paid: 'success', unpaid: 'warning', overdue: 'destructive' }

const schema = z.object({
  name: z.string().trim().min(1, 'Name this bill').max(60),
  amount: z.coerce.number({ invalid_type_error: 'Enter an amount' }).positive('Must be greater than zero'),
  due_date: z.string().min(1, 'Pick a due date'),
})

function BillForm({ open, onOpenChange, profileId, editing, onSaved }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', amount: '', due_date: '' },
    values: editing ? { name: editing.name, amount: Number(editing.amount), due_date: editing.due_date } : undefined,
  })

  const onSubmit = async (data) => {
    try {
      if (editing) await updateBill(editing.id, data)
      else await createBill(profileId, { ...data, status: 'unpaid' })
      toast.success(editing ? 'Bill updated' : 'Bill added')
      onOpenChange(false)
      reset()
      onSaved()
      notifyDataChanged()
    } catch (e) {
      console.error(e)
      toast.error('Could not save bill', { description: e.message })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{editing ? 'Edit bill' : 'Add bill'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Bill name" error={errors.name?.message}>
            <Input placeholder="e.g. Electricity" autoFocus list="bill-suggestions" {...register('name')} />
            <datalist id="bill-suggestions">
              {['Electricity', 'Water', 'Internet', 'Rent', 'Phone'].map((b) => <option key={b} value={b} />)}
            </datalist>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount" error={errors.amount?.message}>
              <Input type="number" step="any" min="0" inputMode="decimal" placeholder="0.00" {...register('amount')} />
            </Field>
            <Field label="Due date" error={errors.due_date?.message}>
              <Input type="date" {...register('due_date')} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{editing ? 'Save' : 'Add bill'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function Bills() {
  const { profile, currency } = useProfile()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const { data: bills, loading, refresh } = useAsyncData(() => listBills(profile.id), [profile.id])
  const all = bills || []
  const monthKey = format(new Date(), 'yyyy-MM')
  const thisMonth = all.filter((b) => b.due_date?.startsWith(monthKey))
  const unpaid = all.filter((b) => b.status !== 'paid')
  const upcoming = unpaid.filter((b) => (dueInfo(b.due_date).days ?? 0) >= 0)
  const overdue = unpaid.filter((b) => (dueInfo(b.due_date).days ?? 0) < 0)
  const paidHistory = all.filter((b) => b.status === 'paid')

  const togglePaid = async (bill) => {
    const next = bill.status === 'paid' ? 'unpaid' : 'paid'
    await updateBill(bill.id, { status: next })
    toast.success(next === 'paid' ? `${bill.name} marked paid` : `${bill.name} marked unpaid`)
    refresh()
    notifyDataChanged()
  }

  const Row = ({ bill }) => {
    const due = dueInfo(bill.due_date)
    const paid = bill.status === 'paid'
    return (
      <div className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-accent/50 sm:px-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
          <Zap className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('truncate text-sm font-medium', paid && 'text-muted-foreground line-through')}>{bill.name}</p>
          <p className="text-xs text-muted-foreground">{due.label}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <p className={cn('text-sm font-bold tabular-nums', paid && 'text-muted-foreground line-through')}>{formatMoney(bill.amount, currency)}</p>
          <Badge variant={STATUS_BADGES[bill.status] || 'secondary'}>{bill.status}</Badge>
        </div>
        <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={paid ? 'Mark unpaid' : 'Mark paid'} title={paid ? 'Mark unpaid' : 'Mark paid'} onClick={() => togglePaid(bill)}>
            {paid ? <Undo2 className="h-4 w-4" /> : <Check className="h-4 w-4 text-emerald-600" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Edit" onClick={() => { setEditing(bill); setFormOpen(true) }}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label="Delete" onClick={() => setDeleting(bill)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Bills Tracker" description="Never miss a due date again.">
        <Button onClick={() => { setEditing(null); setFormOpen(true) }}><Plus /> Add bill</Button>
      </PageHeader>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Due this month" value={formatMoney(sum(thisMonth), currency)} icon={ReceiptText} tone="blue" sub={`${thisMonth.length} bill${thisMonth.length === 1 ? '' : 's'}`} />
        <StatCard label="Still unpaid" value={formatMoney(sum(unpaid), currency)} icon={Zap} tone="amber" sub={`${unpaid.length} open`} />
        <StatCard label="Overdue" value={overdue.length} icon={ReceiptText} tone={overdue.length > 0 ? 'red' : 'default'} sub={overdue.length > 0 ? formatMoney(sum(overdue), currency) : 'All caught up'} />
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : all.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="No bills tracked"
          description="Add electricity, water, internet, rent — SaveWise reminds you before they're due."
          actionLabel="Add bill"
          onAction={() => { setEditing(null); setFormOpen(true) }}
        />
      ) : (
        <div className="space-y-4">
          {overdue.length > 0 ? (
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">Overdue</h2>
              <Card className="divide-y overflow-hidden border-red-200 dark:border-red-900/60">
                {overdue.map((b) => <Row key={b.id} bill={b} />)}
              </Card>
            </div>
          ) : null}
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Upcoming</h2>
            {upcoming.length === 0 ? (
              <Card><p className="px-5 py-6 text-center text-sm text-muted-foreground">Nothing due — enjoy the peace 🎉</p></Card>
            ) : (
              <Card className="divide-y overflow-hidden">{upcoming.map((b) => <Row key={b.id} bill={b} />)}</Card>
            )}
          </div>
          {paidHistory.length > 0 ? (
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Paid</h2>
              <Card className="divide-y overflow-hidden">{paidHistory.map((b) => <Row key={b.id} bill={b} />)}</Card>
            </div>
          ) : null}
        </div>
      )}

      <BillForm open={formOpen} onOpenChange={setFormOpen} profileId={profile.id} editing={editing} onSaved={refresh} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete "${deleting?.name}"?`}
        description="This removes the bill and its status."
        onConfirm={async () => {
          await deleteBill(deleting.id)
          toast.success('Bill deleted')
          setDeleting(null)
          refresh()
          notifyDataChanged()
        }}
      />
    </div>
  )
}

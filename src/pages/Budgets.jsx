import { useState } from 'react'
import { endOfMonth, format, parseISO } from 'date-fns'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { AlertTriangle, Pencil, Plus, Trash2, Wallet } from 'lucide-react'
import { useProfile } from '@/context/ProfileContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import { listBudgets, createBudget, updateBudget, deleteBudget } from '@/services/budgets'
import { listTransactions } from '@/services/transactions'
import { EXPENSE_CATEGORIES, categoryMeta } from '@/lib/constants'
import { cn, formatMoney, sum, notifyDataChanged } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import EmptyState from '@/components/shared/EmptyState'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import Field from '@/components/shared/Field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const schema = z.object({
  category: z.string().min(1, 'Pick a category'),
  amount: z.coerce.number({ invalid_type_error: 'Enter an amount' }).positive('Amount must be greater than zero'),
})

function BudgetForm({ open, onOpenChange, profileId, month, editing, taken, onSaved }) {
  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { category: '', amount: '' },
    values: editing ? { category: editing.category, amount: Number(editing.amount) } : undefined,
  })
  const available = EXPENSE_CATEGORIES.filter((c) => !taken.includes(c.id) || editing?.category === c.id)

  const onSubmit = async (data) => {
    try {
      if (editing) await updateBudget(editing.id, { amount: data.amount })
      else await createBudget(profileId, { ...data, month })
      toast.success(editing ? 'Budget updated' : 'Budget created')
      onOpenChange(false)
      reset()
      onSaved()
      notifyDataChanged()
    } catch (e) {
      console.error(e)
      toast.error('Could not save budget', { description: e.message })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${editing.category} budget` : 'Create budget'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!editing ? (
            <Field label="Category" error={errors.category?.message}>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {available.map((c) => <SelectItem key={c.id} value={c.id}>{c.id}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          ) : null}
          <Field label="Monthly limit" error={errors.amount?.message}>
            <Input type="number" step="any" min="0" inputMode="decimal" placeholder="5000" autoFocus {...register('amount')} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{editing ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function BudgetCard({ budget, spent, currency, onEdit, onDelete }) {
  const amount = Number(budget.amount)
  const ratio = amount > 0 ? spent / amount : 0
  const pctUsed = Math.round(ratio * 100)
  const meta = categoryMeta('expense', budget.category)
  const Icon = meta.icon
  const barColor = ratio >= 1 ? 'bg-red-500' : ratio >= 0.8 ? 'bg-amber-500' : 'bg-emerald-500'

  return (
    <Card className="animate-fade-in-up">
      <CardContent className="p-5">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${meta.color}1a`, color: meta.color }}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">{budget.category}</p>
              <p className="text-xs text-muted-foreground">{formatMoney(amount, currency)} / month</p>
            </div>
          </div>
          <div className="flex">
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Edit" onClick={() => onEdit(budget)}><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label="Delete" onClick={() => onDelete(budget)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>

        {ratio >= 0.8 ? (
          <Badge variant={ratio >= 1 ? 'destructive' : 'warning'} className="mb-3">
            <AlertTriangle className="h-3 w-3" />
            {ratio >= 1 ? `Over budget by ${formatMoney(spent - amount, currency)}` : `${pctUsed}% used`}
          </Badge>
        ) : null}

        <Progress value={Math.min(100, pctUsed)} className="h-3" indicatorClassName={cn(barColor)} />
        <div className="mt-2.5 flex items-baseline justify-between text-sm">
          <span className="font-semibold tabular-nums">{formatMoney(spent, currency)} <span className="font-normal text-muted-foreground">spent</span></span>
          <span className={cn('tabular-nums text-xs font-medium', ratio >= 1 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
            {ratio >= 1 ? 'No budget left' : `${formatMoney(amount - spent, currency)} left`}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

export default function Budgets() {
  const { profile, currency } = useProfile()
  const [monthInput, setMonthInput] = useState(format(new Date(), 'yyyy-MM'))
  const month = `${monthInput}-01`
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const { data, loading, refresh } = useAsyncData(async () => {
    const [budgets, txns] = await Promise.all([
      listBudgets(profile.id, month),
      listTransactions(profile.id, { from: month, to: format(endOfMonth(parseISO(month)), 'yyyy-MM-dd') }),
    ])
    const spent = {}
    for (const t of txns) {
      if (t.type === 'expense') spent[t.category] = (spent[t.category] || 0) + Number(t.amount)
    }
    return { budgets, spent }
  }, [profile.id, month])

  const budgets = data?.budgets || []
  const totalBudget = sum(budgets)
  const totalSpent = budgets.reduce((a, b) => a + (data?.spent[b.category] || 0), 0)

  return (
    <div>
      <PageHeader title="Budget Planner" description="Give every category a monthly limit.">
        <Input type="month" className="w-40" value={monthInput} onChange={(e) => setMonthInput(e.target.value)} />
        <Button onClick={() => { setEditing(null); setFormOpen(true) }}><Plus /> Budget</Button>
      </PageHeader>

      {budgets.length > 0 ? (
        <Card className="mb-5">
          <CardContent className="p-5">
            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-sm font-medium text-muted-foreground">Total budgeted</p>
              <p className="text-sm font-semibold tabular-nums">
                {formatMoney(totalSpent, currency)} <span className="font-normal text-muted-foreground">of {formatMoney(totalBudget, currency)}</span>
              </p>
            </div>
            <Progress value={totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0} className="h-3" />
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : budgets.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No budgets this month"
          description="Set spending limits per category and SaveWise will warn you before you blow past them."
          actionLabel="Create budget"
          onAction={() => { setEditing(null); setFormOpen(true) }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {budgets.map((b) => (
            <BudgetCard
              key={b.id}
              budget={b}
              spent={data.spent[b.category] || 0}
              currency={currency}
              onEdit={(x) => { setEditing(x); setFormOpen(true) }}
              onDelete={setDeleting}
            />
          ))}
        </div>
      )}

      <BudgetForm
        open={formOpen}
        onOpenChange={setFormOpen}
        profileId={profile.id}
        month={month}
        editing={editing}
        taken={budgets.map((b) => b.category)}
        onSaved={refresh}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.category} budget?`}
        description="Transactions are kept — only the budget limit is removed."
        onConfirm={async () => {
          await deleteBudget(deleting.id)
          toast.success('Budget deleted')
          setDeleting(null)
          refresh()
        }}
      />
    </div>
  )
}

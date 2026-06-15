import { useMemo, useState } from 'react'
import { endOfMonth, format, parseISO } from 'date-fns'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowDownRight, ArrowUpRight, ArrowLeftRight, Pencil, Plus, Search, Trash2, Wallet } from 'lucide-react'
import { useProfile } from '@/context/ProfileContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import { listTransactions, createTransaction, updateTransaction, deleteTransaction } from '@/services/transactions'
import { evaluateAchievements } from '@/lib/achievements'
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, categoryMeta } from '@/lib/constants'
import { cn, formatMoney, formatDate, todayISO, sum, notifyDataChanged } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import StatCard from '@/components/shared/StatCard'
import EmptyState from '@/components/shared/EmptyState'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import Field from '@/components/shared/Field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const schema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.coerce.number({ invalid_type_error: 'Enter an amount' }).positive('Amount must be greater than zero'),
  category: z.string().min(1, 'Pick a category'),
  date: z.string().min(1, 'Pick a date'),
  notes: z.string().max(200).optional(),
})

function TransactionForm({ open, onOpenChange, profileId, editing, onSaved }) {
  const { currency } = useProfile()
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { type: 'expense', amount: '', category: '', date: todayISO(), notes: '' },
    values: editing
      ? { type: editing.type, amount: Number(editing.amount), category: editing.category, date: editing.date, notes: editing.notes || '' }
      : undefined,
  })
  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors, isSubmitting } } = form
  const type = watch('type')
  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  const onSubmit = async (data) => {
    try {
      const payload = { ...data, notes: data.notes || null }
      if (editing) await updateTransaction(editing.id, payload)
      else await createTransaction(profileId, payload, currency)
      toast.success(editing ? 'Transaction updated' : 'Transaction added')
      onOpenChange(false)
      reset()
      onSaved()
      const unlocked = await evaluateAchievements(profileId)
      unlocked.forEach((a) => toast(`${a.icon} Achievement unlocked: ${a.title}`))
      notifyDataChanged()
    } catch (e) {
      console.error(e)
      toast.error('Could not save transaction', { description: e.message })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit transaction' : 'Add transaction'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Tabs value={type} onValueChange={(v) => { setValue('type', v); setValue('category', '') }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="expense"><ArrowDownRight className="h-4 w-4" /> Expense</TabsTrigger>
              <TabsTrigger value="income"><ArrowUpRight className="h-4 w-4" /> Income</TabsTrigger>
            </TabsList>
          </Tabs>

          <Field label="Amount" error={errors.amount?.message}>
            <Input type="number" step="any" min="0" inputMode="decimal" placeholder="0.00" autoFocus {...register('amount')} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category" error={errors.category?.message}>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Date" error={errors.date?.message}>
              <Input type="date" {...register('date')} />
            </Field>
          </div>

          <Field label="Notes" hint="Optional">
            <Textarea placeholder="What was this for?" {...register('notes')} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{editing ? 'Save changes' : 'Add transaction'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Row({ txn, currency, onEdit, onDelete }) {
  const meta = categoryMeta(txn.type, txn.category)
  const Icon = meta.icon
  const income = txn.type === 'income'
  // Bug 3: show the original recorded amount in small text when it was
  // recorded in a different currency than the current display currency.
  const showOriginal = txn.original_currency && txn.original_currency !== currency

  return (
    <div className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50 sm:px-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${meta.color}1a`, color: meta.color }}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{txn.category}</p>
        <p className="truncate text-xs text-muted-foreground">{txn.notes || formatDate(txn.date)}</p>
      </div>
      <div className="text-right">
        <p className={cn('text-sm font-bold tabular-nums', income ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground')}>
          {income ? '+' : '−'}{formatMoney(txn.displayAmount ?? txn.amount, currency)}
        </p>
        {showOriginal && (
          <p className="text-[10px] tabular-nums text-muted-foreground">
            {formatMoney(txn.amount, txn.original_currency)}
          </p>
        )}
      </div>
      <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Edit" onClick={() => onEdit(txn)}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label="Delete" onClick={() => onDelete(txn)}><Trash2 className="h-4 w-4" /></Button>
      </div>
    </div>
  )
}

export default function Transactions() {
  const { profile, currency, convertAmount } = useProfile()
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [catFilter, setCatFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const { data: txns, loading, refresh } = useAsyncData(
    () => listTransactions(profile.id, { from: `${month}-01`, to: format(endOfMonth(parseISO(`${month}-01`)), 'yyyy-MM-dd') }),
    [profile.id, month]
  )

  // Bug 2 fix: map every transaction to include a `displayAmount` (converted to
  // the profile's display currency) while keeping `amount` intact so the edit
  // form always shows the original recorded value.
  const displayTxns = useMemo(
    () =>
      (txns || []).map((t) => ({
        ...t,
        displayAmount: convertAmount(t.amount, t.original_currency),
      })),
    [txns, convertAmount],
  )

  const filtered = useMemo(() => {
    let rows = displayTxns
    if (typeFilter !== 'all') rows = rows.filter((t) => t.type === typeFilter)
    if (catFilter !== 'all') rows = rows.filter((t) => t.category === catFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      rows = rows.filter((t) => (t.notes || '').toLowerCase().includes(q) || t.category.toLowerCase().includes(q))
    }
    return rows
  }, [txns, typeFilter, catFilter, search])

  const grouped = useMemo(() => {
    const map = new Map()
    for (const t of filtered) {
      if (!map.has(t.date)) map.set(t.date, [])
      map.get(t.date).push(t)
    }
    return [...map.entries()]
  }, [filtered])

  const income   = sum(displayTxns.filter((t) => t.type === 'income'),  'displayAmount')
  const expenses = sum(displayTxns.filter((t) => t.type === 'expense'), 'displayAmount')
  const allCategories = [...new Set([...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES].map((c) => c.id))]

  return (
    <div>
      <PageHeader title="Transactions" description="Every peso in and out.">
        <Button onClick={() => { setEditing(null); setFormOpen(true) }}><Plus /> Add</Button>
      </PageHeader>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Income" value={formatMoney(income, currency)} icon={ArrowUpRight} tone="primary" sub={formatDate(`${month}-01`, 'MMMM yyyy')} />
        <StatCard label="Expenses" value={formatMoney(expenses, currency)} icon={ArrowDownRight} tone="red" sub={formatDate(`${month}-01`, 'MMMM yyyy')} />
        <StatCard label="Net" value={formatMoney(income - expenses, currency)} icon={Wallet} tone={income - expenses >= 0 ? 'primary' : 'amber'} sub="Income − expenses" />
      </div>

      <Card className="mb-5">
        <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <div className="relative col-span-2 sm:col-span-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search notes…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {allCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : grouped.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="No transactions found"
          description="Add your first transaction or adjust the filters."
          actionLabel="Add transaction"
          onAction={() => { setEditing(null); setFormOpen(true) }}
        />
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, rows]) => (
            <Card key={date} className="overflow-hidden">
              <div className="flex items-center justify-between border-b bg-secondary/50 px-4 py-2 sm:px-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{formatDate(date, 'EEEE, MMM d')}</p>
                <p className="text-xs font-medium tabular-nums text-muted-foreground">
                  {formatMoney(
                    sum(rows.filter((t) => t.type === 'income'),  'displayAmount') -
                    sum(rows.filter((t) => t.type === 'expense'), 'displayAmount'),
                    currency,
                  )}
                </p>
              </div>
              <div className="divide-y">
                {rows.map((t) => (
                  <Row key={t.id} txn={t} currency={currency} onEdit={(x) => { setEditing(x); setFormOpen(true) }} onDelete={setDeleting} />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <TransactionForm open={formOpen} onOpenChange={setFormOpen} profileId={profile.id} editing={editing} onSaved={refresh} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete transaction?"
        description="This can't be undone."
        onConfirm={async () => {
          await deleteTransaction(deleting.id)
          toast.success('Transaction deleted')
          setDeleting(null)
          refresh()
          notifyDataChanged()
        }}
      />
    </div>
  )
}
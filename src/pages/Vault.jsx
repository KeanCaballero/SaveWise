import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Pencil, Plus, Trash2, Users, Vault as VaultIcon } from 'lucide-react'
import { useProfile } from '@/context/ProfileContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import { listVaults, listContributions, createVault, updateVault, deleteVault, addContribution, deleteContribution } from '@/services/vaults'
import { CHART_COLORS } from '@/lib/constants'
import { formatMoney, formatDate, pct, sum, todayISO, notifyDataChanged } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import EmptyState from '@/components/shared/EmptyState'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import Field from '@/components/shared/Field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const vaultSchema = z.object({
  name: z.string().trim().min(1, 'Name the vault').max(60),
  target_amount: z.coerce.number({ invalid_type_error: 'Enter a target' }).positive('Must be greater than zero'),
})

const contributionSchema = z.object({
  contributor_name: z.string().trim().min(1, 'Who contributed?').max(40),
  amount: z.coerce.number({ invalid_type_error: 'Enter an amount' }).positive('Must be greater than zero'),
  date: z.string().min(1, 'Pick a date'),
})

function VaultForm({ open, onOpenChange, profileId, editing, onSaved }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(vaultSchema),
    defaultValues: { name: '', target_amount: '' },
    values: editing ? { name: editing.name, target_amount: Number(editing.target_amount) } : undefined,
  })

  const onSubmit = async (data) => {
    try {
      if (editing) await updateVault(editing.id, data)
      else await createVault(profileId, data)
      toast.success(editing ? 'Vault updated' : 'Vault created')
      onOpenChange(false)
      reset()
      onSaved()
    } catch (e) {
      console.error(e)
      toast.error('Could not save vault', { description: e.message })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit vault' : 'New family vault'}</DialogTitle>
          <DialogDescription>A shared goal everyone can chip into.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Vault name" error={errors.name?.message}>
            <Input placeholder="e.g. Emergency Fund" autoFocus {...register('name')} />
          </Field>
          <Field label="Target amount" error={errors.target_amount?.message}>
            <Input type="number" step="any" min="0" placeholder="100000" {...register('target_amount')} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{editing ? 'Save' : 'Create vault'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ContributionForm({ vault, names, onOpenChange, profileId, onSaved }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(contributionSchema),
    defaultValues: { contributor_name: '', amount: '', date: todayISO() },
  })
  if (!vault) return null

  const onSubmit = async (data) => {
    try {
      await addContribution(profileId, vault.id, data)
      toast.success(`${data.contributor_name} contributed ${formatMoney(data.amount)}`)
      onOpenChange(false)
      reset()
      onSaved()
      notifyDataChanged()
    } catch (e) {
      console.error(e)
      toast.error('Could not add contribution', { description: e.message })
    }
  }

  return (
    <Dialog open={Boolean(vault)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Add contribution — {vault.name}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Contributor" error={errors.contributor_name?.message}>
            <Input placeholder="e.g. Maria" autoFocus list="contributor-names" {...register('contributor_name')} />
            <datalist id="contributor-names">
              {names.map((n) => <option key={n} value={n} />)}
            </datalist>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount" error={errors.amount?.message}>
              <Input type="number" step="any" min="0" inputMode="decimal" placeholder="0.00" {...register('amount')} />
            </Field>
            <Field label="Date" error={errors.date?.message}>
              <Input type="date" {...register('date')} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>Add</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function VaultCard({ vault, contributions, currency, onEdit, onDelete, onContribute, onDeleteContribution }) {
  const total = sum(contributions)
  const progress = pct(total, Number(vault.target_amount))

  const breakdown = useMemo(() => {
    const map = {}
    for (const c of contributions) map[c.contributor_name] = (map[c.contributor_name] || 0) + Number(c.amount)
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [contributions])

  return (
    <Card className="animate-fade-in-up">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2"><VaultIcon className="h-5 w-5 text-primary" /> {vault.name}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatMoney(total, currency)} of {formatMoney(vault.target_amount, currency)} · {breakdown.length} contributor{breakdown.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex">
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Edit" onClick={() => onEdit(vault)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label="Delete" onClick={() => onDelete(vault)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <Progress value={progress} className="h-3.5" />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{progress}% funded</span>
            <span className="tabular-nums">{formatMoney(Math.max(0, Number(vault.target_amount) - total), currency)} to go</span>
          </div>
        </div>

        {breakdown.length > 0 ? (
          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contributor breakdown</p>
            {breakdown.map(([name, amount], i) => (
              <div key={name} className="flex items-center gap-3">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                  style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                >
                  {name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between text-sm">
                    <span className="truncate font-medium">{name}</span>
                    <span className="tabular-nums text-muted-foreground">{formatMoney(amount, currency)} · {pct(amount, total)}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full" style={{ width: `${pct(amount, total)}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <Button variant="secondary" className="w-full" onClick={() => onContribute(vault)}><Plus /> Add contribution</Button>

        {contributions.length > 0 ? (
          <>
            <Separator />
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent contributions</p>
              <div className="space-y-1">
                {contributions.slice(0, 6).map((c) => (
                  <div key={c.id} className="group flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-accent/50">
                    <span className="text-muted-foreground">{formatDate(c.date)} — <span className="font-medium text-foreground">{c.contributor_name}</span></span>
                    <span className="flex items-center gap-1">
                      <span className="font-semibold tabular-nums">{formatMoney(c.amount, currency)}</span>
                      <button
                        aria-label="Remove contribution"
                        className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                        onClick={() => onDeleteContribution(c)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default function Vault() {
  const { profile, currency } = useProfile()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [contributing, setContributing] = useState(null)

  const { data, loading, refresh } = useAsyncData(async () => {
    const [vaults, contributions] = await Promise.all([listVaults(profile.id), listContributions(profile.id)])
    return { vaults, contributions }
  }, [profile.id])

  const vaults = data?.vaults || []
  const contributions = data?.contributions || []
  const names = [...new Set(contributions.map((c) => c.contributor_name))]

  return (
    <div>
      <PageHeader title="Family Vault" description="Shared goals the whole household funds together.">
        <Button onClick={() => { setEditing(null); setFormOpen(true) }}><Plus /> New vault</Button>
      </PageHeader>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-80" />)}</div>
      ) : vaults.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No family vaults yet"
          description="Create a shared goal — an emergency fund, a family trip — and track everyone's contributions."
          actionLabel="Create vault"
          onAction={() => { setEditing(null); setFormOpen(true) }}
        />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {vaults.map((v) => (
            <VaultCard
              key={v.id}
              vault={v}
              contributions={contributions.filter((c) => c.vault_id === v.id)}
              currency={currency}
              onEdit={(x) => { setEditing(x); setFormOpen(true) }}
              onDelete={setDeleting}
              onContribute={setContributing}
              onDeleteContribution={async (c) => {
                await deleteContribution(c.id)
                toast.success('Contribution removed')
                refresh()
              }}
            />
          ))}
        </div>
      )}

      <VaultForm open={formOpen} onOpenChange={setFormOpen} profileId={profile.id} editing={editing} onSaved={refresh} />
      <ContributionForm vault={contributing} names={names} profileId={profile.id} onOpenChange={(o) => !o && setContributing(null)} onSaved={refresh} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete "${deleting?.name}"?`}
        description="All contribution history in this vault is removed too."
        onConfirm={async () => {
          await deleteVault(deleting.id)
          toast.success('Vault deleted')
          setDeleting(null)
          refresh()
        }}
      />
    </div>
  )
}

import { isToday, parseISO } from 'date-fns'
import { Bell, BellRing, Check, CheckCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useProfile } from '@/context/ProfileContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import { listNotifications, markRead, markAllRead, clearAll } from '@/services/notifications'
import { cn, formatDate, notifyDataChanged } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import EmptyState from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const TYPE_ICONS = {
  loan: '💰', bill: '🧾', subscription: '🔁', goal: '🎯', budget: '⚠️', achievement: '🏆', system: '🔔',
}

export default function Notifications() {
  const { profile } = useProfile()
  const { data: items, loading, refresh } = useAsyncData(() => listNotifications(profile.id), [profile.id])
  const all = items || []
  const today = all.filter((n) => isToday(parseISO(n.created_at)))
  const earlier = all.filter((n) => !isToday(parseISO(n.created_at)))
  const unread = all.filter((n) => !n.read).length

  const Row = ({ n }) => (
    <button
      className={cn(
        'flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent/50 sm:px-5',
        !n.read && 'bg-primary/[0.04] dark:bg-primary/[0.06]'
      )}
      onClick={async () => {
        if (!n.read) {
          await markRead(n.id)
          refresh()
          notifyDataChanged()
        }
      }}
    >
      <span className="mt-0.5 text-xl">{TYPE_ICONS[n.type] || '🔔'}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={cn('truncate text-sm', n.read ? 'font-medium text-muted-foreground' : 'font-semibold')}>{n.title}</span>
          {!n.read ? <span className="h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
        </span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{n.message}</span>
        <span className="mt-1 block text-xs text-muted-foreground/70">{formatDate(n.created_at, 'MMM d, h:mm a')}</span>
      </span>
      {!n.read ? <Check className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" /> : null}
    </button>
  )

  const Section = ({ title, rows }) =>
    rows.length === 0 ? null : (
      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
        <Card className="divide-y overflow-hidden">{rows.map((n) => <Row key={n.id} n={n} />)}</Card>
      </div>
    )

  return (
    <div>
      <PageHeader title="Notifications" description={unread > 0 ? `${unread} unread` : 'All caught up'}>
        <Button
          variant="outline"
          size="sm"
          disabled={unread === 0}
          onClick={async () => {
            await markAllRead(profile.id)
            refresh()
            notifyDataChanged()
          }}
        >
          <CheckCheck /> Mark all read
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={all.length === 0}
          onClick={async () => {
            await clearAll(profile.id)
            toast.success('Notifications cleared')
            refresh()
            notifyDataChanged()
          }}
        >
          <Trash2 /> Clear
        </Button>
      </PageHeader>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : all.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="Reminders about due bills, loans, renewals, milestones and budget alerts will land here."
        />
      ) : (
        <div className="space-y-5">
          <Section title="Today" rows={today} />
          <Section title="Earlier" rows={earlier} />
        </div>
      )}
    </div>
  )
}

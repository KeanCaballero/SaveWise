import { useEffect } from 'react'
import { Lock, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { useProfile } from '@/context/ProfileContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import { ACHIEVEMENTS, evaluateAchievements } from '@/lib/achievements'
import { celebrate } from '@/lib/feedback'
import { listUnlocked } from '@/services/achievements'
import { cn, formatDate, notifyDataChanged } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

export default function Achievements() {
  const { profile } = useProfile()

  const { data: unlocked, loading, refresh } = useAsyncData(() => listUnlocked(profile.id), [profile.id])

  // Evaluate on visit so badge state is always fresh.
  useEffect(() => {
    evaluateAchievements(profile.id).then((newly) => {
      if (newly.length > 0) {
        celebrate()
        newly.forEach((a) => toast(`${a.icon} Achievement unlocked: ${a.title}`))
        refresh()
        notifyDataChanged()
      }
    }).catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id])

  const unlockedMap = new Map((unlocked || []).map((u) => [u.achievement_id, u]))
  const count = unlockedMap.size

  return (
    <div>
      <PageHeader title="Achievements" description="Build the habit. Earn the badges." />

      <Card className="mb-6">
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Trophy className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">{count} of {ACHIEVEMENTS.length} unlocked</p>
            <Progress value={(count / ACHIEVEMENTS.length) * 100} className="mt-2 h-2.5" indicatorClassName="bg-amber-500" />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-44" />)}</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {ACHIEVEMENTS.map((a) => {
            const got = unlockedMap.get(a.id)
            return (
              <Card
                key={a.id}
                onClick={got ? () => celebrate() : undefined}
                title={got ? 'Play again' : undefined}
                className={cn(
                  'relative overflow-hidden text-center transition-all',
                  got ? 'cursor-pointer border-amber-300 shadow-lift hover:-translate-y-0.5 active:scale-[0.98] dark:border-amber-700' : 'opacity-70 grayscale'
                )}
              >
                <CardContent className="flex flex-col items-center gap-2 p-5">
                  <span className={cn('text-4xl transition-transform', got && 'animate-fade-in-up')}>{a.icon}</span>
                  <p className="text-sm font-semibold leading-tight">{a.title}</p>
                  <p className="text-xs leading-snug text-muted-foreground">{a.description}</p>
                  {got ? (
                    <Badge variant="warning" className="mt-1">{formatDate(got.unlocked_at)}</Badge>
                  ) : (
                    <Badge variant="secondary" className="mt-1"><Lock className="h-3 w-3" /> Locked</Badge>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

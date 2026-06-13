import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Plus, FlaskConical, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { isSupabaseConfigured } from '@/lib/supabase'
import { isDemoMode } from '@/services/storage'
import { listProfiles, deleteProfile } from '@/services/profiles'
import { listGoals } from '@/services/goals'
import { seedDemoData } from '@/lib/seed'
import { useAsyncData } from '@/hooks/useAsyncData'
import { useProfile } from '@/context/ProfileContext'
import { formatDate, pct, sum } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import PinDialog from './PinDialog'
import ProfileFormDialog from './ProfileFormDialog'

function Branding() {
  return (
    <div className="mb-10 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-3xl font-extrabold text-primary-foreground shadow-lift">S</div>
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Welcome to SaveWise</h1>
      <p className="mt-1.5 font-medium text-muted-foreground">Track. Save. Grow.</p>
    </div>
  )
}

function ProfileCard({ profile, goals, onSelect, onDelete }) {
  const target = sum(goals, 'target_amount')
  const saved = sum(goals, 'current_amount')
  const progress = pct(saved, target)
  return (
    <Card
      className="group relative cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lift"
      onClick={() => onSelect(profile)}
    >
      <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
        <ProfileAvatar profile={profile} size="lg" />
        <div>
          <p className="flex items-center justify-center gap-1.5 font-semibold">
            {profile.name}
            {profile.is_demo ? <Badge variant="info">demo</Badge> : null}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {profile.last_active_at ? `Last active ${formatDate(profile.last_active_at)}` : 'New profile'}
          </p>
        </div>
        {target > 0 ? (
          <div className="w-full">
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>Savings goals</span>
              <span className="font-semibold text-foreground">{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        ) : null}
      </CardContent>
      {profile.is_demo ? (
        <button
          aria-label="Remove demo data"
          title="Remove demo data"
          className="absolute right-2.5 top-2.5 rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(profile)
          }}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null}
    </Card>
  )
}

export default function ProfileGate() {
  const navigate = useNavigate()
  const { unlock } = useProfile()
  const [pinFor, setPinFor] = useState(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [seeding, setSeeding] = useState(false)

  const { data, loading, refresh } = useAsyncData(async () => {
    const profiles = await listProfiles()
    const goalsByProfile = {}
    await Promise.all(
      profiles.map(async (p) => {
        goalsByProfile[p.id] = await listGoals(p.id)
      })
    )
    return { profiles, goalsByProfile }
  }, [])

  if (!isSupabaseConfigured() && !isDemoMode()) return <Navigate to="/setup" replace />

  const profiles = data?.profiles || []

  const handleUnlocked = async (profile) => {
    await unlock(profile)
    navigate('/dashboard')
  }

  const handleSeed = async () => {
    setSeeding(true)
    try {
      const profile = await seedDemoData()
      toast.success('Sample data loaded', { description: 'Demo profile PIN is 1234.' })
      await handleUnlocked(profile)
    } catch (e) {
      console.error(e)
      toast.error('Could not load sample data', { description: e.message })
      refresh()
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-3xl animate-fade-in-up py-10">
        <Branding />

        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48" />)}
          </div>
        ) : profiles.length === 0 ? (
          <Card className="mx-auto max-w-md">
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
              <p className="text-sm text-muted-foreground">Let's create your first profile — or explore SaveWise with realistic sample data first.</p>
              <Button size="lg" className="w-full" onClick={() => setCreating(true)}>
                <Plus /> Create Profile
              </Button>
              <Button size="lg" variant="outline" className="w-full" onClick={handleSeed} disabled={seeding}>
                <FlaskConical /> {seeding ? 'Loading sample data…' : 'Start with sample data'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <p className="mb-4 text-center text-sm font-medium text-muted-foreground">Select profile</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {profiles.map((p) => (
                <ProfileCard
                  key={p.id}
                  profile={p}
                  goals={data.goalsByProfile[p.id] || []}
                  onSelect={setPinFor}
                  onDelete={setDeleting}
                />
              ))}
              <button
                onClick={() => setCreating(true)}
                className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Plus className="h-7 w-7" />
                <span className="text-sm font-medium">Create New Profile</span>
              </button>
            </div>
          </>
        )}
      </div>

      <PinDialog profile={pinFor} open={Boolean(pinFor)} onOpenChange={(o) => !o && setPinFor(null)} onUnlocked={handleUnlocked} />
      <ProfileFormDialog open={creating} onOpenChange={setCreating} onSaved={handleUnlocked} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Remove demo data?"
        description="This permanently deletes the demo profile and everything in it."
        confirmLabel="Remove demo data"
        onConfirm={async () => {
          await deleteProfile(deleting.id)
          toast.success('Demo data removed')
          setDeleting(null)
          refresh()
        }}
      />
    </div>
  )
}

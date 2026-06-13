import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Plus, FlaskConical, Trash2, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { isSupabaseConfigured } from '@/lib/supabase'
import { isDemoMode } from '@/services/storage'
import { getKnownProfileIds, rememberProfile, forgetProfile } from '@/services/storage'
import { listProfiles, deleteProfile, claimProfile } from '@/services/profiles'
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import Field from '@/components/shared/Field'
import PinInput from '@/components/shared/PinInput'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import PinDialog from './PinDialog'
import ProfileFormDialog from './ProfileFormDialog'

function Branding() {
  return (
    <div className="mb-10 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-primary/80 font-display text-3xl font-semibold text-primary-foreground shadow-glow">S</div>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Welcome to SaveWise</h1>
      <p className="mt-1.5 font-medium text-muted-foreground">Track. Save. Grow.</p>
    </div>
  )
}

/** Add an existing profile to this device via name + PIN (no list is shown). */
function ClaimProfileDialog({ open, onOpenChange, onClaimed }) {
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setName('')
      setPin('')
      setMsg(null)
    }
  }, [open])

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim() || pin.length < 4 || busy) return
    setBusy(true)
    let res
    try {
      res = await claimProfile(name, pin)
    } catch {
      setBusy(false)
      setMsg('Something went wrong. Please try again.')
      return
    }
    setBusy(false)
    if (res.ok) {
      onClaimed(res.profile)
      return
    }
    if (res.status === 'locked') {
      const mins = Math.ceil((res.secondsRemaining || 0) / 60)
      setMsg(`That profile is locked. Try again in ${mins} min.`)
    } else {
      // Same message whether the name exists or not — don't confirm names.
      setMsg('No profile matches that name and PIN.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Use an existing profile</DialogTitle>
          <DialogDescription>Enter your profile name and PIN to add it to this device.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Profile name">
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kean" />
          </Field>
          <Field label="PIN">
            <PinInput value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
          </Field>
          {msg ? <p className="text-center text-xs font-medium text-destructive">{msg}</p> : null}
          <Button type="submit" className="w-full" disabled={busy || !name.trim() || pin.length < 4}>
            {busy ? 'Checking…' : 'Add to this device'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
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
      <button
        aria-label="Remove from this device"
        title={profile.is_demo ? 'Remove demo data' : 'Remove from this device'}
        className="absolute right-2.5 top-2.5 rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation()
          onDelete(profile)
        }}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </Card>
  )
}

export default function ProfileGate() {
  const navigate = useNavigate()
  const { unlock } = useProfile()
  const [pinFor, setPinFor] = useState(null)
  const [creating, setCreating] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [seeding, setSeeding] = useState(false)

  const { data, loading, refresh } = useAsyncData(async () => {
    const known = getKnownProfileIds()
    const all = await listProfiles()
    const profiles = all.filter((p) => known.includes(p.id))
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

  // Remember the profile on this device, then open it.
  const handleUnlocked = async (profile) => {
    rememberProfile(profile.id)
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
      toast.error('Could not load sample data', { description: e.message })
      refresh()
    } finally {
      setSeeding(false)
    }
  }

  // For a profile created/added here, deleting removes its data. Otherwise we
  // just forget it on this device (the profile itself stays for other devices).
  const handleRemove = async (profile) => {
    if (profile.is_demo) {
      await deleteProfile(profile.id)
      toast.success('Demo data removed')
    } else {
      forgetProfile(profile.id)
      toast.success(`${profile.name} hidden from this device`)
    }
    setRemoving(null)
    refresh()
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
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No profiles on this device yet. Create yours, add an existing one, or explore with sample data.
              </p>
              <Button size="lg" className="mt-1 w-full" onClick={() => setCreating(true)}>
                <Plus /> Create Profile
              </Button>
              <Button size="lg" variant="outline" className="w-full" onClick={() => setClaiming(true)}>
                <LogIn /> I already have a profile
              </Button>
              <Button size="lg" variant="ghost" className="w-full" onClick={handleSeed} disabled={seeding}>
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
                  onDelete={setRemoving}
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
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Using your profile on a new device?{' '}
              <button onClick={() => setClaiming(true)} className="font-medium text-primary hover:underline">
                Add an existing profile
              </button>
            </p>
          </>
        )}
      </div>

      <PinDialog profile={pinFor} open={Boolean(pinFor)} onOpenChange={(o) => !o && setPinFor(null)} onUnlocked={handleUnlocked} />
      <ProfileFormDialog open={creating} onOpenChange={setCreating} onSaved={handleUnlocked} />
      <ClaimProfileDialog open={claiming} onOpenChange={setClaiming} onClaimed={handleUnlocked} />
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={removing?.is_demo ? 'Remove demo data?' : `Hide ${removing?.name} from this device?`}
        description={
          removing?.is_demo
            ? 'This permanently deletes the demo profile and everything in it.'
            : 'This only hides the profile on this device — its data is kept and stays available on other devices. You can add it back any time with its name and PIN.'
        }
        confirmLabel={removing?.is_demo ? 'Remove demo data' : 'Hide from device'}
        onConfirm={() => handleRemove(removing)}
      />
    </div>
  )
}

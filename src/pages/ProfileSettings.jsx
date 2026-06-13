import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { FlaskConical, KeyRound, Lock, LogOut, Moon, Sun, Monitor, Trash2, UserRound } from 'lucide-react'
import { useProfile } from '@/context/ProfileContext'
import { useTheme } from '@/context/ThemeContext'
import { changePin, deleteProfile } from '@/services/profiles'
import { saveSettings } from '@/services/settings'
import { isDemoMode, exitDemoMode } from '@/services/storage'
import { isSupabaseConfigured } from '@/lib/supabase'
import { CURRENCY_OPTIONS, formatMoney } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import Field from '@/components/shared/Field'
import PinInput from '@/components/shared/PinInput'
import ProfileFormDialog from '@/pages/gate/ProfileFormDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

function ChangePinDialog({ open, onOpenChange, profile }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!/^\d{4,6}$/.test(next)) return toast.error('New PIN must be 4–6 digits')
    if (next !== confirm) return toast.error('New PINs do not match')
    setBusy(true)
    try {
      const res = await changePin(profile.id, current, next)
      if (!res.ok) {
        toast.error(res.status === 'wrong' ? 'Current PIN is incorrect' : 'Could not change PIN')
        return
      }
      toast.success('PIN changed')
      onOpenChange(false)
      setCurrent(''); setNext(''); setConfirm('')
    } catch (e) {
      toast.error('Could not change PIN', { description: e.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Change PIN</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Current PIN">
            <PinInput value={current} onChange={(e) => setCurrent(e.target.value.replace(/\D/g, ''))} autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="New PIN">
              <PinInput value={next} onChange={(e) => setNext(e.target.value.replace(/\D/g, ''))} />
            </Field>
            <Field label="Confirm">
              <PinInput value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ''))} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy || current.length < 4 || next.length < 4}>Change PIN</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function ProfileSettings() {
  const { profile, settings, currency, refreshProfile, lock } = useProfile()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const [editOpen, setEditOpen] = useState(false)
  const [pinOpen, setPinOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const updateSetting = async (patch) => {
    await saveSettings(profile.id, { ...settings, ...patch })
    await refreshProfile()
    toast.success('Settings saved')
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Profile & Settings" />

      {isDemoMode() ? (
        <Alert variant="info" className="mb-5">
          <FlaskConical />
          <AlertTitle>Demo Mode</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>Data lives only in this browser. Connect Supabase for real persistence.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                exitDemoMode()
                lock()
                navigate(isSupabaseConfigured() ? '/profiles' : '/setup')
              }}
            >
              Exit Demo Mode & erase demo data
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <ProfileAvatar profile={profile} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-lg font-bold">
              {profile?.name}
              {profile?.is_demo ? <Badge variant="info">demo</Badge> : null}
            </p>
            <p className="text-sm text-muted-foreground">
              {profile?.monthly_income_goal ? `Income goal ${formatMoney(profile.monthly_income_goal, currency)}/mo` : 'No income goal'}
              {' · '}
              {profile?.monthly_savings_goal ? `Savings goal ${formatMoney(profile.monthly_savings_goal, currency)}/mo` : 'No savings goal'}
            </p>
          </div>
          <Button variant="outline" onClick={() => setEditOpen(true)}><UserRound /> Edit profile</Button>
        </CardContent>
      </Card>

      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="text-base">Preferences</CardTitle>
          <CardDescription>Appearance and formatting for this device.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Theme</p>
              <p className="text-xs text-muted-foreground">Light, dark, or follow your system.</p>
            </div>
            <div className="flex gap-1 rounded-xl bg-secondary p-1">
              {[['light', Sun], ['dark', Moon], ['system', Monitor]].map(([value, Icon]) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${theme === value ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Icon className="h-3.5 w-3.5" /> {value}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Currency</p>
              <p className="text-xs text-muted-foreground">Used everywhere amounts are shown.</p>
            </div>
            <Select value={currency} onValueChange={(v) => updateSetting({ currency: v })}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="text-base">Security</CardTitle>
          <CardDescription>Your PIN protects this profile on shared devices.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setPinOpen(true)}><KeyRound /> Change PIN</Button>
          <Button
            variant="outline"
            onClick={() => {
              lock()
              navigate('/profiles')
            }}
          >
            <Lock /> Lock now
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              lock()
              navigate('/profiles')
            }}
          >
            <LogOut /> Switch profile
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
          <CardDescription>Deleting a profile removes all of its data — transactions, goals, loans, everything.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 /> Delete this profile
          </Button>
        </CardContent>
      </Card>

      <ProfileFormDialog open={editOpen} onOpenChange={setEditOpen} profile={profile} onSaved={refreshProfile} />
      <ChangePinDialog open={pinOpen} onOpenChange={setPinOpen} profile={profile} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete "${profile?.name}" forever?`}
        description="Every transaction, budget, goal, loan, bill, subscription, vault, and achievement in this profile will be permanently removed."
        confirmLabel="Delete profile"
        onConfirm={async () => {
          await deleteProfile(profile.id)
          toast.success('Profile deleted')
          lock()
          navigate('/profiles')
        }}
      />
    </div>
  )
}

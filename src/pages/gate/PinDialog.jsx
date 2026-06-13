import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import PinInput from '@/components/shared/PinInput'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import { verifyPin } from '@/services/profiles'
import { cn } from '@/lib/utils'

export default function PinDialog({ profile, open, onOpenChange, onUnlocked }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (open) {
      setPin('')
      setError(false)
    }
  }, [open])

  if (!profile) return null

  const submit = async (e) => {
    e.preventDefault()
    if (pin.length < 4) return
    setChecking(true)
    const ok = await verifyPin(profile, pin)
    setChecking(false)
    if (ok) {
      onUnlocked(profile)
    } else {
      setError(true)
      setPin('')
      setTimeout(() => setError(false), 600)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader className="items-center text-center">
          <ProfileAvatar profile={profile} size="lg" className="mb-2" />
          <DialogTitle>Hi, {profile.name}</DialogTitle>
          <DialogDescription>Enter your PIN to unlock this profile.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className={cn(error && 'animate-shake')}>
            <PinInput
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          {error ? <p className="text-center text-xs font-medium text-destructive">Incorrect PIN — try again.</p> : null}
          <Button type="submit" className="w-full" disabled={pin.length < 4 || checking}>
            {checking ? 'Checking…' : 'Unlock'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

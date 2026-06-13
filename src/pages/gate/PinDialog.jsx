import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import PinInput from '@/components/shared/PinInput'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import { verifyPin } from '@/services/profiles'
import { cn } from '@/lib/utils'

function formatCountdown(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function PinDialog({ profile, open, onOpenChange, onUnlocked }) {
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)
  const [message, setMessage] = useState(null)
  const [checking, setChecking] = useState(false)
  const [lockSeconds, setLockSeconds] = useState(0)

  useEffect(() => {
    if (open) {
      setPin('')
      setShake(false)
      setMessage(null)
      setLockSeconds(0)
    }
  }, [open])

  // Tick down the lockout timer; clear the message when it expires.
  useEffect(() => {
    if (lockSeconds <= 0) return
    const t = setInterval(() => {
      setLockSeconds((s) => {
        if (s <= 1) {
          setMessage(null)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [lockSeconds])

  if (!profile) return null

  const locked = lockSeconds > 0

  const submit = async (e) => {
    e.preventDefault()
    if (pin.length < 4 || checking || locked) return
    setChecking(true)
    let res
    try {
      res = await verifyPin(profile, pin)
    } catch {
      setChecking(false)
      setMessage("Couldn't verify PIN. Check your connection and try again.")
      return
    }
    setChecking(false)

    if (res.ok) {
      onUnlocked(profile)
      return
    }

    setPin('')
    if (res.status === 'locked') {
      setLockSeconds(res.secondsRemaining || 0)
      setMessage(null)
    } else if (res.status === 'wrong') {
      const left = res.attemptsRemaining
      setMessage(left === 1 ? 'Incorrect PIN — 1 attempt left before lockout.' : `Incorrect PIN — ${left} attempts left.`)
      setShake(true)
      setTimeout(() => setShake(false), 600)
    } else {
      setMessage('Something went wrong. Please try again.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader className="items-center text-center">
          <ProfileAvatar profile={profile} size="lg" className="mb-2" />
          <DialogTitle>Hi, {profile.name}</DialogTitle>
          <DialogDescription>
            {locked ? 'This profile is temporarily locked.' : 'Enter your PIN to unlock this profile.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className={cn(shake && 'animate-shake')}>
            <PinInput
              autoFocus
              disabled={locked}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            />
          </div>

          {locked ? (
            <p className="text-center text-xs font-medium text-destructive">
              Too many attempts. Try again in {formatCountdown(lockSeconds)}.
            </p>
          ) : message ? (
            <p className="text-center text-xs font-medium text-destructive">{message}</p>
          ) : null}

          <Button type="submit" className="w-full" disabled={pin.length < 4 || checking || locked}>
            {checking ? 'Checking…' : locked ? 'Locked' : 'Unlock'}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
            Back
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

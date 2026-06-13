import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useProfile } from '@/context/ProfileContext'
import { unreadCount } from '@/services/notifications'
import { appEvents } from '@/lib/utils'

export default function NotificationsBell() {
  const { profile } = useProfile()
  const [count, setCount] = useState(0)

  const load = useCallback(() => {
    if (!profile) return
    unreadCount(profile.id).then(setCount).catch(() => {})
  }, [profile])

  useEffect(() => {
    load()
    appEvents.addEventListener('savewise:data', load)
    return () => appEvents.removeEventListener('savewise:data', load)
  }, [load])

  return (
    <Button variant="ghost" size="icon" asChild className="relative">
      <Link to="/notifications" aria-label="Notifications">
        <Bell className="h-5 w-5" />
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {count > 9 ? '9+' : count}
          </span>
        ) : null}
      </Link>
    </Button>
  )
}

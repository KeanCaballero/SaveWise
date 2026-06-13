import { avatarColorClass } from '@/lib/constants'
import { cn } from '@/lib/utils'

export default function ProfileAvatar({ profile, size = 'md', className }) {
  const sizes = { sm: 'h-9 w-9 text-lg', md: 'h-12 w-12 text-2xl', lg: 'h-20 w-20 text-4xl' }
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-2xl text-white shadow-sm',
        avatarColorClass(profile?.avatar_color),
        sizes[size],
        className
      )}
    >
      <span className="leading-none">{profile?.avatar || '🦊'}</span>
    </div>
  )
}

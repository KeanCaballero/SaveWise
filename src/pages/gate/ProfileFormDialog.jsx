import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Field from '@/components/shared/Field'
import PinInput from '@/components/shared/PinInput'
import { AVATAR_EMOJIS, AVATAR_COLORS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { createProfile, updateProfile } from '@/services/profiles'

const baseSchema = {
  name: z.string().trim().min(1, 'Name is required').max(30, 'Keep it under 30 characters'),
  avatar: z.string(),
  avatar_color: z.string(),
  monthly_income_goal: z.union([z.coerce.number().positive('Must be positive'), z.literal('')]).optional(),
  monthly_savings_goal: z.union([z.coerce.number().positive('Must be positive'), z.literal('')]).optional(),
}

const createSchema = z
  .object({
    ...baseSchema,
    pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4–6 digits'),
    pin_confirm: z.string(),
  })
  .refine((d) => d.pin === d.pin_confirm, { message: 'PINs do not match', path: ['pin_confirm'] })

const editSchema = z.object(baseSchema)

/** Create (with PIN) or edit (no PIN — changed separately) a profile. */
export default function ProfileFormDialog({ open, onOpenChange, profile = null, onSaved }) {
  const editing = Boolean(profile)
  const form = useForm({
    resolver: zodResolver(editing ? editSchema : createSchema),
    defaultValues: { name: '', avatar: AVATAR_EMOJIS[0], avatar_color: 'emerald', pin: '', pin_confirm: '', monthly_income_goal: '', monthly_savings_goal: '' },
  })
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = form
  const avatar = watch('avatar')
  const color = watch('avatar_color')

  useEffect(() => {
    if (open) {
      reset({
        name: profile?.name || '',
        avatar: profile?.avatar || AVATAR_EMOJIS[0],
        avatar_color: profile?.avatar_color || 'emerald',
        pin: '',
        pin_confirm: '',
        monthly_income_goal: profile?.monthly_income_goal ?? '',
        monthly_savings_goal: profile?.monthly_savings_goal ?? '',
      })
    }
  }, [open, profile, reset])

  const onSubmit = async (data) => {
    try {
      const fields = {
        name: data.name,
        avatar: data.avatar,
        avatar_color: data.avatar_color,
        monthly_income_goal: data.monthly_income_goal === '' ? null : data.monthly_income_goal,
        monthly_savings_goal: data.monthly_savings_goal === '' ? null : data.monthly_savings_goal,
      }
      const saved = editing
        ? await updateProfile(profile.id, fields)
        : await createProfile({ ...fields, pin: data.pin })
      toast.success(editing ? 'Profile updated' : `Welcome, ${saved.name}!`)
      onOpenChange(false)
      onSaved?.(saved)
    } catch (e) {
      console.error(e)
      toast.error('Could not save profile', { description: e.message })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit profile' : 'Create your profile'}</DialogTitle>
          <DialogDescription>
            {editing ? 'Update how this profile looks.' : 'Profiles keep finances separate. Each one is protected by its own PIN.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Profile name" error={errors.name?.message}>
            <Input placeholder="e.g. John" autoFocus {...register('name')} />
          </Field>

          <Field label="Avatar">
            <div className="flex flex-wrap gap-2">
              {AVATAR_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setValue('avatar', e)}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl border text-xl transition-all hover:scale-105',
                    avatar === e ? 'border-primary bg-primary/10 ring-2 ring-primary' : 'border-input bg-card'
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Avatar color">
            <div className="flex flex-wrap gap-2.5">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-label={c.id}
                  onClick={() => setValue('avatar_color', c.id)}
                  className={cn(
                    'h-8 w-8 rounded-full transition-all hover:scale-110',
                    c.class,
                    color === c.id && 'ring-2 ring-foreground ring-offset-2 ring-offset-card'
                  )}
                />
              ))}
            </div>
          </Field>

          {!editing ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="PIN (4–6 digits)" error={errors.pin?.message}>
                <PinInput value={watch('pin')} onChange={(e) => setValue('pin', e.target.value.replace(/\D/g, ''), { shouldValidate: true })} />
              </Field>
              <Field label="Confirm PIN" error={errors.pin_confirm?.message}>
                <PinInput value={watch('pin_confirm')} onChange={(e) => setValue('pin_confirm', e.target.value.replace(/\D/g, ''), { shouldValidate: true })} />
              </Field>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Monthly income goal" hint="Optional" error={errors.monthly_income_goal?.message}>
              <Input type="number" step="any" min="0" placeholder="35000" {...register('monthly_income_goal')} />
            </Field>
            <Field label="Monthly savings goal" hint="Optional" error={errors.monthly_savings_goal?.message}>
              <Input type="number" step="any" min="0" placeholder="8000" {...register('monthly_savings_goal')} />
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{editing ? 'Save changes' : 'Create profile'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import {
  format, parseISO, differenceInCalendarDays, startOfMonth, endOfMonth, subMonths,
} from 'date-fns'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

const CURRENCY_LOCALES = {
  PHP: 'en-PH', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB', JPY: 'ja-JP',
  INR: 'en-IN', AUD: 'en-AU', CAD: 'en-CA', SGD: 'en-SG',
}

export const CURRENCY_OPTIONS = Object.keys(CURRENCY_LOCALES)

export function formatMoney(amount, currency = 'PHP', opts = {}) {
  const n = Number(amount) || 0
  return new Intl.NumberFormat(CURRENCY_LOCALES[currency] || 'en-PH', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
    ...opts,
  }).format(n)
}

export function toDate(value) {
  if (!value) return null
  return typeof value === 'string' ? parseISO(value) : value
}

export function formatDate(value, pattern = 'MMM d, yyyy') {
  const d = toDate(value)
  return d ? format(d, pattern) : '—'
}

export function todayISO() {
  return format(new Date(), 'yyyy-MM-dd')
}

export function monthStartISO(date = new Date()) {
  return format(startOfMonth(date), 'yyyy-MM-dd')
}

export function monthEndISO(date = new Date()) {
  return format(endOfMonth(date), 'yyyy-MM-dd')
}

export function prevMonthStartISO(date = new Date()) {
  return format(startOfMonth(subMonths(date, 1)), 'yyyy-MM-dd')
}

/** Days from today until `value` (negative = past). */
export function daysUntil(value) {
  const d = toDate(value)
  if (!d) return null
  return differenceInCalendarDays(d, new Date())
}

/** Human label + tone for a due date. */
export function dueInfo(value) {
  const days = daysUntil(value)
  if (days === null) return { label: 'No due date', tone: 'muted', days }
  if (days < 0) return { label: `Overdue by ${-days}d`, tone: 'destructive', days }
  if (days === 0) return { label: 'Due today', tone: 'warning', days }
  if (days === 1) return { label: 'Due tomorrow', tone: 'warning', days }
  if (days <= 7) return { label: `Due in ${days}d`, tone: 'info', days }
  return { label: formatDate(value), tone: 'muted', days }
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

export function pct(part, total) {
  if (!total || total <= 0) return 0
  return clamp(Math.round((part / total) * 100), 0, 100)
}

export function sum(rows, field = 'amount') {
  return (rows || []).reduce((acc, r) => acc + (Number(r?.[field]) || 0), 0)
}

/** SHA-256 hash for PIN codes (client-side profile protection, not auth). */
export async function hashPin(pin) {
  const data = new TextEncoder().encode(`savewise::${pin}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

/** Monthly-normalized cost of a subscription. */
export function monthlyCost(sub) {
  const cost = Number(sub.cost) || 0
  if (sub.billing_cycle === 'weekly') return cost * 4.345
  if (sub.billing_cycle === 'yearly') return cost / 12
  return cost
}

/** Notify listeners (e.g. notification bell) that data changed. */
export const appEvents = new EventTarget()
export function notifyDataChanged() {
  appEvents.dispatchEvent(new Event('savewise:data'))
}

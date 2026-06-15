import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import {
  format, parseISO, differenceInCalendarDays, startOfMonth, endOfMonth, subMonths,
} from 'date-fns'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

const CURRENCY_LOCALES = {
  // Asia-Pacific
  PHP: 'en-PH',  // Philippine Peso
  JPY: 'ja-JP',  // Japanese Yen
  CNY: 'zh-CN',  // Chinese Yuan
  KRW: 'ko-KR',  // South Korean Won
  INR: 'en-IN',  // Indian Rupee
  SGD: 'en-SG',  // Singapore Dollar
  HKD: 'zh-HK',  // Hong Kong Dollar
  THB: 'th-TH',  // Thai Baht
  MYR: 'ms-MY',  // Malaysian Ringgit
  IDR: 'id-ID',  // Indonesian Rupiah
  AUD: 'en-AU',  // Australian Dollar
  NZD: 'en-NZ',  // New Zealand Dollar
  // Americas
  USD: 'en-US',  // US Dollar
  CAD: 'en-CA',  // Canadian Dollar
  BRL: 'pt-BR',  // Brazilian Real
  MXN: 'es-MX',  // Mexican Peso
  // Europe
  EUR: 'de-DE',  // Euro
  GBP: 'en-GB',  // British Pound
  CHF: 'de-CH',  // Swiss Franc
  SEK: 'sv-SE',  // Swedish Krona
  NOK: 'nb-NO',  // Norwegian Krone
  DKK: 'da-DK',  // Danish Krone
  PLN: 'pl-PL',  // Polish Zloty
  TRY: 'tr-TR',  // Turkish Lira
  // Africa & Middle East
  ZAR: 'en-ZA',  // South African Rand
  ILS: 'he-IL',  // Israeli Shekel
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

/**
 * SHA-256 PIN hash — used ONLY by Demo Mode (in-browser localStorage DB).
 * With Supabase, PINs are bcrypt-hashed and verified server-side via the
 * verify_profile_pin / create_profile / change_profile_pin RPCs; the hash
 * never reaches the client. See services/profiles.js.
 */
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
export const formatUsd = (amount: number) => `US$${(amount || 0).toLocaleString('en-US')}`

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export const formatDate = (value: string | Date | undefined | null) => {
  if (!value) return ''
  const d = new Date(value)
  return isNaN(d.getTime()) ? '' : dateFormat.format(d)
}

/** The next date a premium falls due: this month's payment day, or next month's if it has passed. */
export function nextDueDate(paymentDay: number, from: Date = new Date()): Date {
  const due = new Date(from.getFullYear(), from.getMonth(), paymentDay || 1)
  if (due < new Date(from.getFullYear(), from.getMonth(), from.getDate())) due.setMonth(due.getMonth() + 1)
  return due
}

/** "3 days ago", "yesterday", "today" for a past ISO timestamp. */
export function formatRelativeDays(iso?: string | null, now: Date = new Date()): string {
  if (!iso) return 'recently'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return 'recently'
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

/** Two-letter initials for an avatar. */
export function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]![0]!
  const last = parts.length > 1 ? parts[parts.length - 1]![0]! : ''
  return (first + last).toUpperCase()
}

/** 1 -> "1st", 22 -> "22nd", 28 -> "28th". */
export function ordinal(n: number): string {
  const rest = n % 100
  if (rest >= 11 && rest <= 13) return `${n}th`
  const suffix = ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'
  return `${n}${suffix}`
}

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

/** Formats a calendar day (`YYYY-MM-DD`) without letting the viewer's timezone shift it by one. */
export const formatDay = (isoDay?: string | null) => {
  if (!isoDay) return ''
  const d = new Date(`${isoDay.slice(0, 10)}T00:00:00Z`)
  return isNaN(d.getTime()) ? isoDay : dayFormat.format(d)
}

const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Africa/Harare',
})

/** "Wednesday, 10 September, 10:00" in Zimbabwe time, whatever the viewer's timezone. */
export const formatServiceTime = (iso?: string | null) => {
  if (!iso) return 'Not set'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return 'Not set'
  return dateTimeFormat.format(d)
}

/** "12 minutes ago", "3 hours ago", "2 days ago": for lists where recent time matters (triage queues). */
export function formatAge(iso?: string | null, now: Date = new Date()): string {
  if (!iso) return 'recently'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return 'recently'
  const minutes = Math.max(0, Math.round((now.getTime() - d.getTime()) / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.round(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

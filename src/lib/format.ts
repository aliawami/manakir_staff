/**
 * Small display helpers. Times are shown in Saudi time (Asia/Riyadh) whatever
 * the viewer's computer is set to, because the staff and the applicants are
 * in Saudi Arabia and "submitted at 11 pm" must mean the same to everyone.
 */

const TIME_ZONE = 'Asia/Riyadh'

const dateOnly = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: TIME_ZONE,
})

const dateAndTime = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: TIME_ZONE,
})

export function formatDate(iso: string): string {
  return dateOnly.format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return dateAndTime.format(new Date(iso))
}

const DAY_MS = 24 * 60 * 60 * 1000

/** "today", "1 day ago", "5 days ago": whole days between then and now. */
export function ageLabel(iso: string, now: Date = new Date()): string {
  const days = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS))
  if (days === 0) return 'today'
  return days === 1 ? '1 day ago' : `${days} days ago`
}

/** The applicant's name, or null when the account has none (blank or a single space). */
export function realName(fullName: string): string | null {
  const trimmed = fullName.trim()
  return trimmed === '' ? null : trimmed
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

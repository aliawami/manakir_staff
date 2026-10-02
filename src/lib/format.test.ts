import { describe, expect, it } from 'vitest'
import { ageLabel, formatDate, formatDateTime, realName } from './format'

describe('formatDate / formatDateTime', () => {
  it('shows Saudi time (UTC+3) whatever the computer is set to', () => {
    // 23:30 UTC on the 14th is already 02:30 on the 15th in Riyadh.
    expect(formatDate('2026-01-14T23:30:00Z')).toBe('15 Jan 2026')
    expect(formatDateTime('2026-01-14T23:30:00Z')).toMatch(/^15 Jan 2026.*02:30$/)
  })
})

describe('ageLabel', () => {
  const now = new Date('2026-03-10T12:00:00Z')

  it('says today, 1 day ago, N days ago', () => {
    expect(ageLabel('2026-03-10T01:00:00Z', now)).toBe('today')
    expect(ageLabel('2026-03-09T11:00:00Z', now)).toBe('1 day ago')
    expect(ageLabel('2026-03-05T12:00:00Z', now)).toBe('5 days ago')
  })

  it('never goes negative if the server clock is slightly ahead', () => {
    expect(ageLabel('2026-03-10T12:00:30Z', now)).toBe('today')
  })
})

describe('realName', () => {
  it('treats blank and whitespace-only names as no name', () => {
    expect(realName(' ')).toBeNull()
    expect(realName('')).toBeNull()
    expect(realName('  Noura Alqahtani ')).toBe('Noura Alqahtani')
  })
})

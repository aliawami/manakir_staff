import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/errors'
import {
  addDays,
  ar,
  collectionErrorMessage,
  formatAmount,
  formatDay,
  formatMoment,
  formatWeek,
  isDayIso,
} from './collections'

const ARABIC_INDIC_DIGITS = /[٠-٩]/

describe('formatAmount', () => {
  it('always shows two decimals with a thousands separator, in Latin digits', () => {
    expect(formatAmount('23.00')).toBe('23.00')
    expect(formatAmount('1234.5')).toBe('1,234.50')
    expect(formatAmount('0')).toBe('0.00')
    expect(formatAmount('1000000.00')).toBe('1,000,000.00')
  })

  it('leaves something that is not a number as it is rather than showing NaN', () => {
    expect(formatAmount('abc')).toBe('abc')
  })
})

describe('dates', () => {
  it('shows a day in the Gregorian calendar with Latin digits', () => {
    expect(formatDay('2026-10-25')).toBe('25 أكتوبر 2026')
    expect(formatDay('2026-11-07')).toBe('7 نوفمبر 2026')
    expect(formatDay('2026-10-25')).not.toMatch(ARABIC_INDIC_DIGITS)
  })

  it('does not move a day because of a time zone', () => {
    // Midnight UTC is 03:00 in Riyadh and 19:00 the day before in New York.
    for (const day of ['2026-01-01', '2026-12-31', '2026-03-29']) {
      expect(formatDay(day)).toContain(String(Number(day.slice(8))))
    }
  })

  it('shows a moment in Saudi time', () => {
    // 09:00 UTC is 12:00 in Riyadh.
    expect(formatMoment('2026-10-28T09:00:00Z')).toContain('12:00')
    // 22:00 UTC on the 28th is already the 29th in Riyadh.
    expect(formatMoment('2026-10-28T22:00:00Z')).toContain('29 أكتوبر 2026')
  })

  it('writes a week as from-to', () => {
    expect(formatWeek('2026-10-25', '2026-10-31')).toBe('من 25 أكتوبر 2026 إلى 31 أكتوبر 2026')
  })

  it('adds days across a month end', () => {
    expect(addDays('2026-10-31', 7)).toBe('2026-11-07')
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04')
  })

  it('recognises a real calendar day only', () => {
    expect(isDayIso('2026-10-25')).toBe(true)
    for (const bad of ['2026-13-01', '2026-02-30x', 'soon', '20261025', '']) {
      expect(isDayIso(bad)).toBe(false)
    }
  })
})

describe('collectionErrorMessage', () => {
  const conflict = (errors: object) => new ApiError(409, 'English text from the server', errors)

  it('never shows the English text the server sent', () => {
    for (const error of [
      conflict({ code: 'nothing_due' }),
      new ApiError(400, 'Invalid data', { note: 'x' }),
      new ApiError(500, 'Boom'),
    ]) {
      expect(collectionErrorMessage(error)).not.toMatch(/[A-Za-z]{3}/)
    }
  })

  it('says what the amount is now when it changed', () => {
    const message = collectionErrorMessage(conflict({ code: 'amount_changed', current_amount: '1234.50' }))
    expect(message).toContain('1,234.50')
    expect(message).toContain(ar.currency)
  })

  it('has a sentence for each reason the server gives', () => {
    expect(collectionErrorMessage(conflict({ code: 'nothing_due' }))).toBe(ar.errors.nothingDue)
    expect(collectionErrorMessage(conflict({ code: 'already_extended' }))).toBe(ar.errors.alreadyExtended)
    expect(collectionErrorMessage(new ApiError(400, 'x', { code: 'invalid_week' }))).toBe(ar.errors.invalidWeek)
    expect(collectionErrorMessage(new ApiError(400, 'x', { note: 'too long' }))).toBe(ar.errors.noteTooLong)
    expect(collectionErrorMessage(new ApiError(400, 'x', { expected_amount: ['bad'] }))).toBe(ar.errors.amount)
  })

  it('tells apart no connection, no permission and not found', () => {
    expect(collectionErrorMessage(new ApiError(0, 'x'))).toBe(ar.errors.network)
    expect(collectionErrorMessage(new ApiError(403, 'x'))).toBe(ar.errors.forbidden)
    expect(collectionErrorMessage(new ApiError(404, 'x'))).toBe(ar.errors.notFound)
  })

  it('falls back to a general sentence for anything else', () => {
    expect(collectionErrorMessage(new ApiError(500, 'x'))).toBe(ar.errors.generic)
    expect(collectionErrorMessage(new Error('x'))).toBe(ar.errors.generic)
    expect(collectionErrorMessage('x')).toBe(ar.errors.generic)
    expect(collectionErrorMessage(conflict(null as unknown as object))).toBe(ar.errors.generic)
  })
})

/**
 * The Arabic text and number/date formatting of the cash collection screens.
 *
 * These screens are Arabic only (right to left) because the person who uses
 * them reads Arabic. The rest of the app is English; this is the one place
 * that holds the Arabic wording, so a later translation of the whole app can
 * start from here.
 *
 * Numbers and dates are shown with Latin digits (0-9) and the Gregorian
 * calendar, the same as everywhere else in the system. The default Arabic
 * (Saudi) locale would give Arabic-Indic digits and the Hijri calendar.
 */

import { ApiError } from '../api/errors'

export const ar = {
  nav: 'التحصيل',
  title: 'تحصيل العمولات',
  loading: 'جارٍ التحميل…',
  retry: 'أعد المحاولة',
  currency: 'ر.س',

  totals: {
    due: 'إجمالي المستحق',
    overdue: 'منه متأخر',
    statements: 'عدد الكشوف',
    collectedThisMonth: 'المحصَّل هذا الشهر',
    scope: 'المستحق والمتأخر وعدد الكشوف حسب التصفية الحالية. المحصَّل هذا الشهر لا يتأثر بها.',
  },

  tabs: {
    label: 'عرض الكشوف',
    statements: 'الكشوف',
    month: 'المحصَّل هذا الشهر',
  },

  month: {
    collected: 'المحصَّل',
    collectedAt: 'آخر تحصيل',
    empty: 'لم يتم تحصيل أي مبلغ هذا الشهر بعد.',
  },

  filters: {
    status: 'الحالة',
    statusDue: 'مستحق',
    statusCollected: 'تم التحصيل',
    statusAll: 'الكل',
    overdue: 'التأخر',
    overdueAll: 'الكل',
    overdueOnly: 'المتأخر فقط',
    overdueNot: 'غير المتأخر',
    ordering: 'الترتيب',
    oldest: 'الأقدم أولًا',
    newest: 'الأحدث أولًا',
  },

  badge: {
    due: 'مستحق',
    collected: 'تم التحصيل',
    overdue: 'متأخر',
    extended: 'ممدّد',
  },

  list: {
    salon: 'الصالون',
    week: 'الأسبوع',
    dueDate: 'موعد التحصيل',
    bookings: 'الحجوزات',
    due: 'المتبقي',
    status: 'الحالة',
    empty: 'لا توجد كشوف مطابقة لهذه التصفية.',
    emptyPage: 'هذه الصفحة فارغة.',
    goFirst: 'الذهاب إلى الصفحة الأولى',
    previous: 'السابق',
    next: 'التالي',
  },

  detail: {
    back: 'العودة إلى كشوف التحصيل',
    notFoundTitle: 'الكشف غير موجود',
    notFoundBody: 'لا يوجد كشف لهذا الصالون في هذا الأسبوع.',
    salon: 'الصالون',
    week: 'الأسبوع',
    dueDate: 'موعد التحصيل',
    status: 'الحالة',
    bookings: 'عدد الحجوزات',
    cashTotal: 'المبلغ المدفوع نقدًا للصالون',
    commissionTotal: 'العمولة شاملة الضريبة',
    dueTotal: 'المتبقي للتحصيل',
    collectedTotal: 'تم تحصيله',
    lastCollected: 'آخر تحصيل',
    linesTitle: 'الحجوزات في هذا الكشف',
    booking: 'رقم الحجز',
    paidAt: 'تاريخ الدفع',
    cash: 'المبلغ النقدي',
    commission: 'العمولة',
    vat: 'ضريبة العمولة',
    total: 'الإجمالي',
    lineStatus: 'الحالة',
    collectedBy: 'المُحصِّل',
    note: 'ملاحظة',
  },

  actions: {
    title: 'الإجراءات',
    collect: 'تأكيد التحصيل',
    extend: 'تمديد أسبوع واحد',
    alreadyExtended: 'تم تمديد هذا الأسبوع من قبل، ولا يمكن تمديده مرة أخرى.',
    allCollected: 'تم تحصيل هذا الكشف بالكامل.',
    noteLabel: 'ملاحظة (اختياري)',
    cancel: 'إلغاء',
    saving: 'جارٍ الحفظ…',
    collectConfirm: 'نعم، تم الاستلام',
    extendConfirm: 'تمديد',
    collectQuestionStart: 'هل استلمت مبلغ',
    collectQuestionSalon: 'من صالون',
    collectQuestionWeek: 'عن الأسبوع',
    extendQuestion: 'سيصبح موعد التحصيل',
    extendOnce: 'يمكن التمديد مرة واحدة فقط لكل أسبوع.',
    collectedDone: 'تم تسجيل التحصيل.',
    viewCollected: 'عرض المحصَّل هذا الشهر',
    extendedDone: (date: string) => `تم تمديد موعد التحصيل إلى ${date}.`,
  },

  errors: {
    network: 'تعذّر الاتصال بالخادم. تحقق من الاتصال ثم أعد المحاولة.',
    forbidden: 'ليس لديك صلاحية لهذا الإجراء.',
    notFound: 'لم يتم العثور على الكشف.',
    nothingDue: 'لا يوجد مبلغ مستحق في هذا الكشف. ربما تم تحصيله من قبل.',
    alreadyExtended: 'تم تمديد هذا الأسبوع من قبل، ولا يمكن تمديده مرة أخرى.',
    invalidWeek: 'الأسبوع غير صالح.',
    amount: 'المبلغ غير صالح.',
    noteTooLong: 'الملاحظة طويلة جدًا. الحد الأقصى 500 حرف.',
    generic: 'تعذّر إتمام العملية. حاول مرة أخرى.',
    amountChanged: (amount: string) =>
      `تغيّر المبلغ المستحق ليصبح ${amount}. تمت إعادة تحميل الكشف، راجعه ثم أعد المحاولة.`,
  },
} as const

const money = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** "1234.5" -> "1,234.50" (Latin digits, no currency). For display only. */
export function formatAmount(value: string): string {
  const number = Number(value)
  return Number.isFinite(number) ? money.format(number) : value
}

const dayFormat = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

const dateTimeFormat = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Riyadh',
})

const DAY_ISO = /^\d{4}-\d{2}-\d{2}$/

export function isDayIso(value: string): boolean {
  return DAY_ISO.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())
}

/** A calendar day "2026-10-25" -> "25 أكتوبر 2026". The day is not shifted by any time zone. */
export function formatDay(iso: string): string {
  return dayFormat.format(new Date(`${iso}T00:00:00Z`))
}

/** A moment, shown in Saudi time. */
export function formatMoment(iso: string): string {
  return dateTimeFormat.format(new Date(iso))
}

/** The calendar day `days` after "YYYY-MM-DD". */
export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** "من 25 أكتوبر 2026 إلى 31 أكتوبر 2026" */
export function formatWeek(start: string, end: string): string {
  return `من ${formatDay(start)} إلى ${formatDay(end)}`
}

/**
 * The Arabic sentence for a failed request. The server's own messages are
 * English, so they are never shown on these screens: the machine-readable
 * `errors.code` (or the HTTP status) picks the wording instead.
 */
export function collectionErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return ar.errors.generic
  if (error.status === 0) return ar.errors.network
  if (error.status === 403) return ar.errors.forbidden
  if (error.status === 404) return ar.errors.notFound

  const details = typeof error.errors === 'object' && error.errors !== null ? error.errors : {}
  const code = (details as { code?: unknown }).code
  if (code === 'amount_changed') {
    const current = (details as { current_amount?: unknown }).current_amount
    return ar.errors.amountChanged(
      typeof current === 'string' ? `${formatAmount(current)} ${ar.currency}` : '',
    )
  }
  if (code === 'nothing_due') return ar.errors.nothingDue
  if (code === 'already_extended') return ar.errors.alreadyExtended
  if (code === 'invalid_week') return ar.errors.invalidWeek
  if ('note' in details) return ar.errors.noteTooLong
  if ('expected_amount' in details) return ar.errors.amount
  return ar.errors.generic
}

import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fail, networkDown, ok } from '../test/fakeApi'
import type { Handler } from '../test/fakeApi'
import { renderApp } from '../test/renderApp'
import { DETAIL, LIST, detail, pageOf, statement } from '../test/collectionFixtures'
import { COLLECTIONS_READER, FINANCE, REVIEWER, staffServer } from '../test/staffServer'

const listOf =
  (results = [statement()], overrides = {}): Handler =>
  () =>
    ok(pageOf(results, overrides))

function serve(list: Handler = listOf(), me: object = FINANCE) {
  return staffServer({ [LIST]: list }, me)
}

describe('the list', () => {
  it('asks for what is still due, oldest first, 20 per page', async () => {
    const server = serve()
    renderApp('/collections')

    await screen.findByText('صالون ورد')
    const query = server.to(LIST)[0].query
    expect(query.get('status')).toBe('DUE')
    expect(query.get('ordering')).toBe('oldest')
    expect(query.get('page')).toBe('1')
    expect(query.get('page_size')).toBe('20')
    expect(query.has('overdue')).toBe(false)
  })

  it('is Arabic and right to left', async () => {
    serve()
    const { container } = renderApp('/collections')

    await screen.findByText('صالون ورد')
    const section = container.querySelector('section.rtl')!
    expect(section).toHaveAttribute('dir', 'rtl')
    expect(section).toHaveAttribute('lang', 'ar')
    expect(screen.getByRole('heading', { name: 'تحصيل العمولات' })).toBeInTheDocument()
  })

  it('shows a row per salon and week with the amount still due', async () => {
    serve(
      listOf([
        statement(),
        statement({
          salon: { id: 8, name: 'صالون لمسة' },
          week_start: '2026-11-01',
          week_end: '2026-11-07',
          due_date: '2026-11-07',
          bookings_count: 5,
          due_total: '1234.50',
        }),
      ]),
    )
    renderApp('/collections')

    const link = await screen.findByRole('link', { name: 'صالون ورد' })
    expect(link).toHaveAttribute('href', '/collections/7/2026-10-25')
    const row = link.closest('tr')!
    expect(within(row).getByText('من 25 أكتوبر 2026 إلى 31 أكتوبر 2026')).toBeInTheDocument()
    expect(within(row).getByText('31 أكتوبر 2026')).toBeInTheDocument()
    expect(within(row).getByText('2')).toBeInTheDocument()
    expect(within(row).getByText('23.00')).toBeInTheDocument()
    expect(within(row).getByText('مستحق')).toBeInTheDocument()

    const second = screen.getByRole('link', { name: 'صالون لمسة' }).closest('tr')!
    expect(within(second).getByText('1,234.50')).toBeInTheDocument()
    expect(second.textContent).toContain('ر.س')
  })

  it('flags a late week and an extended one', async () => {
    serve(listOf([statement({ overdue: true, extended: true })]))
    renderApp('/collections')

    const row = (await screen.findByRole('link', { name: 'صالون ورد' })).closest('tr')!
    expect(within(row).getByText('متأخر')).toBeInTheDocument()
    expect(within(row).getByText('ممدّد')).toBeInTheDocument()
  })

  it('shows a collected week as collected, not late', async () => {
    serve(listOf([statement({ status: 'COLLECTED', due_total: '0.00' })]))
    renderApp('/collections?status=all')

    const row = (await screen.findByRole('link', { name: 'صالون ورد' })).closest('tr')!
    expect(within(row).getByText('تم التحصيل')).toBeInTheDocument()
    expect(within(row).queryByText('متأخر')).not.toBeInTheDocument()
  })

  it('shows the totals of everything that matches, not only this page', async () => {
    serve(
      listOf([statement()], {
        count: 45,
        totals: {
          statements: 45,
          due_total: '9876.50',
          overdue_total: '120.00',
          collected_this_month: '4321.75',
        },
      }),
    )
    renderApp('/collections')

    await screen.findByText('9,876.50')
    expect(screen.getByText('120.00')).toBeInTheDocument()
    expect(screen.getByText('45', { selector: 'bdi' })).toBeInTheDocument()
    expect(screen.getByText('إجمالي المستحق')).toBeInTheDocument()
    expect(screen.getByText('منه متأخر')).toBeInTheDocument()
  })

  it('shows what was collected this month, next to its own label', async () => {
    serve(
      listOf([statement()], {
        totals: { statements: 1, due_total: '23.00', overdue_total: '0.00', collected_this_month: '4321.75' },
      }),
    )
    renderApp('/collections')

    const label = await screen.findByText('المحصَّل هذا الشهر', { selector: 'span.muted' })
    expect(within(label.closest('.stat') as HTMLElement).getByText('4,321.75')).toBeInTheDocument()
    expect(screen.getByText(/لا يتأثر بها/)).toBeInTheDocument()
  })

  it('still shows it when the current filter has no rows', async () => {
    serve(
      listOf([], {
        totals: { statements: 0, due_total: '0.00', overdue_total: '0.00', collected_this_month: '55.00' },
      }),
    )
    renderApp('/collections')

    await screen.findByText('لا توجد كشوف مطابقة لهذه التصفية.')
    const label = screen.getByText('المحصَّل هذا الشهر', { selector: 'span.muted' })
    expect(within(label.closest('.stat') as HTMLElement).getByText('55.00')).toBeInTheDocument()
  })

  it('never shows Arabic-Indic digits', async () => {
    serve(listOf([statement({ overdue: true })]))
    const { container } = renderApp('/collections')

    await screen.findByText('صالون ورد')
    expect(container.textContent).not.toMatch(/[٠-٩]/)
  })

  it('says so when nothing matches', async () => {
    serve(
      listOf([], {
        totals: { statements: 0, due_total: '0.00', overdue_total: '0.00', collected_this_month: '0.00' },
      }),
    )
    renderApp('/collections')

    expect(await screen.findByText('لا توجد كشوف مطابقة لهذه التصفية.')).toBeInTheDocument()
  })
})

describe('filters', () => {
  it('asks only for late weeks when "late only" is chosen, from page 1', async () => {
    const server = serve(listOf([statement()], { count: 45 }))
    renderApp('/collections?page=2')
    await screen.findByText('صالون ورد')

    await userEvent.setup().selectOptions(screen.getByLabelText('التأخر'), 'المتأخر فقط')

    await waitFor(() => {
      const last = server.to(LIST).at(-1)!.query
      expect(last.get('overdue')).toBe('true')
      expect(last.get('page')).toBe('1')
    })
  })

  it('asks for the weeks that are not late', async () => {
    const server = serve()
    renderApp('/collections?overdue=no')
    await screen.findByText('صالون ورد')
    expect(server.to(LIST)[0].query.get('overdue')).toBe('false')
  })

  it('"all" statuses sends no status filter', async () => {
    const server = serve()
    renderApp('/collections')
    await screen.findByText('صالون ورد')

    await userEvent.setup().selectOptions(screen.getByLabelText('الحالة'), 'الكل')

    await waitFor(() => expect(server.to(LIST).at(-1)!.query.has('status')).toBe(false))
  })

  it('newest first', async () => {
    const server = serve()
    renderApp('/collections')
    await screen.findByText('صالون ورد')

    await userEvent.setup().selectOptions(screen.getByLabelText('الترتيب'), 'الأحدث أولًا')

    await waitFor(() => expect(server.to(LIST).at(-1)!.query.get('ordering')).toBe('newest'))
  })

  it('ignores nonsense in the address instead of sending it', async () => {
    const server = serve()
    renderApp('/collections?status=PAID&overdue=maybe&page=-4&ordering=zzz')
    await screen.findByText('صالون ورد')
    const query = server.to(LIST)[0].query
    expect(query.get('status')).toBe('DUE')
    expect(query.has('overdue')).toBe(false)
    expect(query.get('page')).toBe('1')
    expect(query.get('ordering')).toBe('oldest')
  })
})

describe('paging', () => {
  it('moves between pages, with "previous" first (on the right)', async () => {
    const server = serve(listOf([statement()], { count: 45 }))
    renderApp('/collections')
    await screen.findByText('صالون ورد')

    const previous = screen.getByRole('button', { name: 'السابق' })
    const next = screen.getByRole('button', { name: 'التالي' })
    expect(previous).toBeDisabled()
    expect(previous.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('1 / 3')).toBeInTheDocument()

    await userEvent.setup().click(next)
    await waitFor(() => expect(server.to(LIST).at(-1)!.query.get('page')).toBe('2'))
  })

  it('offers a way back from a page past the end', async () => {
    serve((call) =>
      call.query.get('page') === '1'
        ? ok(pageOf([statement()], { count: 3 }))
        : ok(pageOf([], { count: 3, page: 9 })),
    )
    renderApp('/collections?page=9')

    await userEvent.setup().click(await screen.findByRole('button', { name: 'الذهاب إلى الصفحة الأولى' }))
    expect(await screen.findByText('صالون ورد')).toBeInTheDocument()
  })
})

describe('the "collected this month" tab', () => {
  const collectedRow = (overrides = {}) =>
    statement({
      status: 'COLLECTED',
      due_total: '0.00',
      collected_total: '40.00',
      collected_this_month: '23.00',
      last_collected_at: '2026-11-02T10:00:00Z',
      ...overrides,
    })

  const monthList = (results = [collectedRow()], totals = {}) =>
    listOf(results, {
      totals: {
        statements: results.length,
        due_total: '5.00',
        overdue_total: '1.00',
        collected_this_month: '23.00',
        ...totals,
      },
    })

  it('has two tabs, and the statements one is open to begin with', async () => {
    serve()
    renderApp('/collections')

    await screen.findByText('صالون ورد')
    const tabs = within(screen.getByRole('tablist', { name: 'عرض الكشوف' })).getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual(['الكشوف', 'المحصَّل هذا الشهر'])
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false'])
  })

  it('opens from the tab and asks only for what was collected this month', async () => {
    const server = serve(monthList())
    renderApp('/collections')
    await screen.findByText('صالون ورد')

    await userEvent.setup().click(screen.getByRole('tab', { name: 'المحصَّل هذا الشهر' }))

    await waitFor(() => expect(server.to(LIST).at(-1)!.query.get('collected_in')).toBe('this_month'))
    const query = server.to(LIST).at(-1)!.query
    expect(query.has('status')).toBe(false)
    expect(query.has('overdue')).toBe(false)
    expect(query.get('page')).toBe('1')
    expect(screen.getByRole('tab', { name: 'المحصَّل هذا الشهر' })).toHaveAttribute('aria-selected', 'true')
  })

  it('can be opened straight from its address', async () => {
    const server = serve(monthList())
    renderApp('/collections?view=month')

    await screen.findByText('صالون ورد')
    expect(server.to(LIST)[0].query.get('collected_in')).toBe('this_month')
    expect(screen.getByRole('tab', { name: 'المحصَّل هذا الشهر' })).toHaveAttribute('aria-selected', 'true')
  })

  it('shows the month total and the number of statements, and none of the filters', async () => {
    serve(monthList([collectedRow(), collectedRow({ salon: { id: 8, name: 'صالون لمسة' } })], { collected_this_month: '46.00' }))
    renderApp('/collections?view=month')

    const label = await screen.findByText('المحصَّل هذا الشهر', { selector: 'span' })
    const stat = label.closest('.stat') as HTMLElement
    expect(within(stat).getByText('46.00')).toBeInTheDocument()
    expect(screen.getByText('2', { selector: 'bdi' })).toBeInTheDocument()
    // What is still due is the other tab's business.
    expect(screen.queryByText('إجمالي المستحق')).not.toBeInTheDocument()
    expect(screen.queryByText('منه متأخر')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('الحالة')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('التأخر')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('الترتيب')).not.toBeInTheDocument()
  })

  it('shows what was collected this month in each row, not the statement\'s whole history', async () => {
    serve(monthList())
    renderApp('/collections?view=month')

    const row = (await screen.findByRole('link', { name: 'صالون ورد' })).closest('tr')!
    expect(within(row).getByText('23.00')).toBeInTheDocument() // this month
    expect(within(row).queryByText('40.00')).not.toBeInTheDocument() // all time
    expect(within(row).getByText('2 نوفمبر 2026 في 13:00')).toBeInTheDocument()
    expect(within(row).getByText('تم التحصيل')).toBeInTheDocument()
    const headers = within(screen.getByRole('table')).getAllByRole('columnheader').map((h) => h.textContent)
    expect(headers).toEqual(['الصالون', 'الأسبوع', 'المحصَّل', 'آخر تحصيل', 'المتبقي', 'الحالة'])
  })

  it('a statement only partly collected still shows what is left', async () => {
    serve(monthList([collectedRow({ status: 'DUE', due_total: '11.50' })]))
    renderApp('/collections?view=month')

    const row = (await screen.findByRole('link', { name: 'صالون ورد' })).closest('tr')!
    expect(within(row).getByText('11.50')).toBeInTheDocument()
    expect(within(row).getByText('مستحق')).toBeInTheDocument()
  })

  it('says so when nothing was collected yet', async () => {
    serve(monthList([], { collected_this_month: '0.00' }))
    renderApp('/collections?view=month')

    expect(await screen.findByText('لم يتم تحصيل أي مبلغ هذا الشهر بعد.')).toBeInTheDocument()
    expect(screen.queryByText('لا توجد كشوف مطابقة لهذه التصفية.')).not.toBeInTheDocument()
  })

  it('pages within the tab', async () => {
    const server = serve(listOf([collectedRow()], { count: 45 }))
    renderApp('/collections?view=month')
    await screen.findByText('صالون ورد')
    expect(screen.getByText('1 / 3')).toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('button', { name: 'التالي' }))

    await waitFor(() => expect(server.to(LIST).at(-1)!.query.get('page')).toBe('2'))
    const query = server.to(LIST).at(-1)!.query
    expect(query.get('collected_in')).toBe('this_month')
    expect(screen.getByRole('tab', { name: 'المحصَّل هذا الشهر' })).toHaveAttribute('aria-selected', 'true')
  })

  it('back from a statement returns to the tab', async () => {
    staffServer(
      {
        [LIST]: monthList(),
        [DETAIL]: () => ok(detail()),
      },
      FINANCE,
    )
    renderApp('/collections?view=month')

    const user = userEvent.setup()
    await user.click(await screen.findByRole('link', { name: 'صالون ورد' }))
    await user.click(await screen.findByRole('link', { name: /العودة إلى كشوف التحصيل/ }))

    expect(await screen.findByRole('tab', { name: 'المحصَّل هذا الشهر', selected: true })).toBeInTheDocument()
  })

  it('the first tab brings back the normal list with its defaults', async () => {
    const server = serve(monthList())
    renderApp('/collections?view=month')
    await screen.findByText('صالون ورد')

    await userEvent.setup().click(screen.getByRole('tab', { name: 'الكشوف' }))

    await waitFor(() => expect(server.to(LIST).at(-1)!.query.get('status')).toBe('DUE'))
    const query = server.to(LIST).at(-1)!.query
    expect(query.has('collected_in')).toBe(false)
    expect(query.get('ordering')).toBe('oldest')
    expect(screen.getByLabelText('الحالة')).toBeInTheDocument()
  })

  it('clicking the tab you are on does not ask the server again', async () => {
    const server = serve(monthList())
    renderApp('/collections?view=month')
    await screen.findByText('صالون ورد')
    const before = server.to(LIST).length

    await userEvent.setup().click(screen.getByRole('tab', { name: 'المحصَّل هذا الشهر' }))

    expect(server.to(LIST)).toHaveLength(before)
  })
})

describe('failures', () => {
  it('shows an Arabic message and tries again', async () => {
    // A failing read is retried once by itself, so the first two calls fail.
    let calls = 0
    serve(() => (++calls <= 2 ? fail(500, 'Server error') : ok(pageOf([statement()]))))
    renderApp('/collections')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('تعذّر إتمام العملية. حاول مرة أخرى.')
    expect(alert.textContent).not.toContain('Server error')
    await userEvent.setup().click(within(alert).getByRole('button', { name: 'أعد المحاولة' }))
    expect(await screen.findByText('صالون ورد')).toBeInTheDocument()
  })

  it('says when the server cannot be reached', async () => {
    serve(networkDown)
    renderApp('/collections')
    expect(await screen.findByRole('alert')).toHaveTextContent('تعذّر الاتصال بالخادم')
  })
})

describe('who sees it', () => {
  it('finance gets the menu link and lands here from the home page', async () => {
    serve()
    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'تحصيل العمولات' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'التحصيل' })).toHaveAttribute('href', '/collections')
  })

  it('a reviewer has no link and is refused the page without asking the server', async () => {
    const server = serve(listOf(), REVIEWER)
    renderApp('/collections')

    expect(await screen.findByRole('heading', { name: 'Not allowed' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'التحصيل' })).not.toBeInTheDocument()
    expect(server.to(LIST)).toHaveLength(0)
  })

  it('someone who can only read still sees the list', async () => {
    serve(listOf(), COLLECTIONS_READER)
    renderApp('/collections')
    expect(await screen.findByText('صالون ورد')).toBeInTheDocument()
  })

  it('a reviewer still lands on the applications queue', async () => {
    staffServer({ 'GET staff/merchant-applications/': () => ok({ count: 0, page: 1, page_size: 20, results: [] }) })
    renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Applications' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'التحصيل' })).not.toBeInTheDocument()
  })
})

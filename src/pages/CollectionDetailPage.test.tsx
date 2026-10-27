import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { fail, networkDown, ok } from '../test/fakeApi'
import type { Handler } from '../test/fakeApi'
import { renderApp } from '../test/renderApp'
import {
  COLLECT,
  DETAIL,
  EXTEND,
  LIST,
  collectedDetail,
  detail,
  line,
  pageOf,
  statement,
} from '../test/collectionFixtures'
import { COLLECTIONS_READER, FINANCE, REVIEWER, staffServer } from '../test/staffServer'

const PATH = '/collections/7/2026-10-25'

function serve(handlers: Record<string, Handler> = {}, me: object = FINANCE) {
  return staffServer({ [DETAIL]: () => ok(detail()), ...handlers }, me)
}

const ui = () => userEvent.setup()

describe('the statement', () => {
  it('shows the salon, the week, the figures and every booking', async () => {
    serve()
    const { container } = renderApp(PATH)

    const title = await screen.findByRole('heading', { level: 1 })
    expect(title).toHaveTextContent('صالون ورد')
    expect(title).toHaveTextContent('من 25 أكتوبر 2026 إلى 31 أكتوبر 2026')
    expect(container.querySelector('section.rtl')).toHaveAttribute('dir', 'rtl')

    const facts = container.querySelector('dl.facts') as HTMLElement
    expect(within(facts).getByText('31 أكتوبر 2026')).toBeInTheDocument()
    expect(within(facts).getByText('230.00')).toBeInTheDocument()
    expect(within(facts).getAllByText('23.00')).toHaveLength(2) // commission, still due
    expect(within(facts).getByText('0.00')).toBeInTheDocument() // collected so far

    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('101')).toBeInTheDocument()
    expect(within(rows[0]).getByText('115.00')).toBeInTheDocument()
    expect(within(rows[0]).getByText('10.00')).toBeInTheDocument()
    expect(within(rows[0]).getByText('1.50')).toBeInTheDocument()
    expect(within(rows[0]).getByText('11.50')).toBeInTheDocument()
    expect(within(rows[0]).getByText('28 أكتوبر 2026 في 12:00')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/[٠-٩]/)
  })

  it('shows who collected a line, when, and the note', async () => {
    serve({ [DETAIL]: () => ok(collectedDetail()) })
    renderApp(PATH)

    const row = within(await screen.findByRole('table')).getAllByRole('row')[1]
    expect(within(row).getByText('تم التحصيل')).toBeInTheDocument()
    expect(row.textContent).toContain('Ghaith')
    expect(row.textContent).toContain('2 نوفمبر 2026')
    expect(within(row).getByText('تم الاستلام باليد')).toBeInTheDocument()
  })

  it('has a link back to the list that keeps the list filters', async () => {
    staffServer(
      {
        [LIST]: () => ok(pageOf([statement()])),
        [DETAIL]: () => ok(detail()),
      },
      FINANCE,
    )
    renderApp('/collections?status=all&overdue=yes')

    await ui().click(await screen.findByRole('link', { name: 'صالون ورد' }))
    const back = await screen.findByRole('link', { name: /العودة إلى كشوف التحصيل/ })
    expect(back.getAttribute('href')).toContain('status=all')
    expect(back.getAttribute('href')).toContain('overdue=yes')
  })

  it('is "not found" when the server has no such statement', async () => {
    serve({ [DETAIL]: () => fail(404, 'Statement not found') })
    renderApp(PATH)
    expect(await screen.findByRole('heading', { name: 'الكشف غير موجود' })).toBeInTheDocument()
  })

  it('does not ask the server about an address that cannot be a statement', async () => {
    const server = serve()
    for (const path of ['/collections/abc/2026-10-25', '/collections/7/2026-13-40', '/collections/7/soon']) {
      const { unmount } = renderApp(path)
      expect(await screen.findByRole('heading', { name: 'الكشف غير موجود' })).toBeInTheDocument()
      unmount()
    }
    expect(server.to(DETAIL)).toHaveLength(0)
  })

  it('shows an Arabic error and tries again', async () => {
    let calls = 0
    serve({ [DETAIL]: () => (++calls <= 2 ? fail(500, 'Boom') : ok(detail())) })
    renderApp(PATH)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('تعذّر إتمام العملية')
    await ui().click(within(alert).getByRole('button', { name: 'أعد المحاولة' }))
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('صالون ورد')
  })
})

describe('who can act', () => {
  it('finance sees both actions on a due statement', async () => {
    serve()
    renderApp(PATH)
    expect(await screen.findByRole('button', { name: 'تأكيد التحصيل' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'تمديد أسبوع واحد' })).toBeEnabled()
  })

  it('someone who can only read sees the figures but no actions', async () => {
    serve({}, COLLECTIONS_READER)
    renderApp(PATH)
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('button', { name: 'تأكيد التحصيل' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'تمديد أسبوع واحد' })).not.toBeInTheDocument()
  })

  it('a reviewer cannot open it', async () => {
    const server = serve({}, REVIEWER)
    renderApp(PATH)
    expect(await screen.findByRole('heading', { name: 'Not allowed' })).toBeInTheDocument()
    expect(server.to(DETAIL)).toHaveLength(0)
  })

  it('a collected statement has nothing left to do', async () => {
    serve({ [DETAIL]: () => ok(collectedDetail()) })
    renderApp(PATH)
    expect(await screen.findByText('تم تحصيل هذا الكشف بالكامل.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'تأكيد التحصيل' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'تمديد أسبوع واحد' })).not.toBeInTheDocument()
  })

  it('an extended week cannot be extended again', async () => {
    serve({ [DETAIL]: () => ok(detail({ extended: true, due_date: '2026-11-07' })) })
    renderApp(PATH)
    expect(await screen.findByRole('button', { name: 'تمديد أسبوع واحد' })).toBeDisabled()
    expect(screen.getByText('تم تمديد هذا الأسبوع من قبل، ولا يمكن تمديده مرة أخرى.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'تأكيد التحصيل' })).toBeEnabled()
  })
})

describe('confirming a collection', () => {
  it('asks first, showing the amount, the salon and the week', async () => {
    const server = serve()
    renderApp(PATH)

    await ui().click(await screen.findByRole('button', { name: 'تأكيد التحصيل' }))

    const form = screen.getByRole('form', { name: 'تأكيد التحصيل' })
    expect(form).toHaveTextContent('هل استلمت مبلغ')
    expect(within(form).getByText('23.00')).toBeInTheDocument()
    expect(form).toHaveTextContent('صالون ورد')
    expect(form).toHaveTextContent('من 25 أكتوبر 2026 إلى 31 أكتوبر 2026')
    expect(server.to(COLLECT)).toHaveLength(0)
  })

  it('cancelling sends nothing', async () => {
    const server = serve()
    renderApp(PATH)
    await ui().click(await screen.findByRole('button', { name: 'تأكيد التحصيل' }))

    await ui().click(screen.getByRole('button', { name: 'إلغاء' }))

    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'تأكيد التحصيل' })).toBeInTheDocument()
    expect(server.to(COLLECT)).toHaveLength(0)
  })

  it('sends the amount that was on screen and the note, then shows the result', async () => {
    const server = serve({ [COLLECT]: () => ok(collectedDetail()) })
    const { queryClient } = renderApp(PATH)
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const user = ui()

    await user.click(await screen.findByRole('button', { name: 'تأكيد التحصيل' }))
    await user.type(screen.getByLabelText('ملاحظة (اختياري)'), '  تم الاستلام باليد  ')
    await user.click(screen.getByRole('button', { name: 'نعم، تم الاستلام' }))

    expect(await screen.findByRole('status')).toHaveTextContent('تم تسجيل التحصيل.')
    expect(server.to(COLLECT)).toHaveLength(1)
    expect(server.to(COLLECT)[0].body).toEqual({ expected_amount: '23.00', note: 'تم الاستلام باليد' })
    expect(await screen.findByText('تم تحصيل هذا الكشف بالكامل.')).toBeInTheDocument()
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    // The list, which still shows this week as due, is marked out of date.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['collections', 'list'] })
    // The answer is used as it is: no second request for the statement.
    expect(server.to(DETAIL)).toHaveLength(1)
  })

  it('after collecting, offers a way to the collected statements', async () => {
    const server = serve({
      [COLLECT]: () => ok(collectedDetail()),
      [LIST]: () => ok(pageOf([])),
    })
    renderApp(PATH)
    const user = ui()
    await user.click(await screen.findByRole('button', { name: 'تأكيد التحصيل' }))
    await user.click(screen.getByRole('button', { name: 'نعم، تم الاستلام' }))

    const link = await within(await screen.findByRole('status')).findByRole('link', {
      name: 'عرض المحصَّل هذا الشهر',
    })
    expect(link.getAttribute('href')).toBe('/collections?view=month&page=1')

    server.calls.length = 0
    await user.click(link)
    await waitFor(() => expect(server.to(LIST).length).toBeGreaterThan(0))
    const asked = server.to(LIST)[0].query
    expect(asked.get('collected_in')).toBe('this_month')
    expect(asked.has('status')).toBe(false)
  })

  it('an empty note is sent as empty', async () => {
    const server = serve({ [COLLECT]: () => ok(collectedDetail()) })
    renderApp(PATH)
    const user = ui()
    await user.click(await screen.findByRole('button', { name: 'تأكيد التحصيل' }))
    await user.click(screen.getByRole('button', { name: 'نعم، تم الاستلام' }))
    await screen.findByRole('status')
    expect(server.to(COLLECT)[0].body).toEqual({ expected_amount: '23.00', note: '' })
  })

  it('limits the note to what the server accepts', async () => {
    serve()
    renderApp(PATH)
    await ui().click(await screen.findByRole('button', { name: 'تأكيد التحصيل' }))
    expect(screen.getByLabelText('ملاحظة (اختياري)')).toHaveAttribute('maxlength', '500')
  })

  it('a second click while saving sends nothing more', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    const server = serve({
      [COLLECT]: async () => {
        await gate
        return ok(collectedDetail())
      },
    })
    renderApp(PATH)
    const user = ui()
    await user.click(await screen.findByRole('button', { name: 'تأكيد التحصيل' }))
    await user.click(screen.getByRole('button', { name: 'نعم، تم الاستلام' }))

    const saving = await screen.findByRole('button', { name: 'جارٍ الحفظ…' })
    expect(saving).toBeDisabled()
    expect(screen.getByRole('button', { name: 'إلغاء' })).toBeDisabled()
    await user.click(saving)
    release()

    await screen.findByRole('status')
    expect(server.to(COLLECT)).toHaveLength(1)
  })

  it('when the amount changed, says what it is now and reloads the statement for another look', async () => {
    let loads = 0
    const server = serve({
      [DETAIL]: () => ok(++loads === 1 ? detail() : detail({ due_total: '34.50', commission_total: '34.50' })),
      [COLLECT]: () =>
        fail(409, 'The amount due is now 34.50, not 23.00.', {
          code: 'amount_changed',
          current_amount: '34.50',
        }),
    })
    renderApp(PATH)
    const user = ui()
    await user.click(await screen.findByRole('button', { name: 'تأكيد التحصيل' }))
    await user.click(screen.getByRole('button', { name: 'نعم، تم الاستلام' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('تغيّر المبلغ المستحق ليصبح 34.50 ر.س')
    expect(alert.textContent).not.toContain('The amount')
    expect(within(alert).queryByRole('link')).not.toBeInTheDocument()
    // The form closed and the statement was loaded again with the new figure.
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    await waitFor(() => expect(server.to(DETAIL)).toHaveLength(2))

    // Confirming again now sends the NEW amount.
    server.calls.length = 0
    await user.click(await screen.findByRole('button', { name: 'تأكيد التحصيل' }))
    expect(within(screen.getByRole('form')).getByText('34.50')).toBeInTheDocument()
  })

  it('already collected: says so and reloads', async () => {
    let loads = 0
    const server = serve({
      [DETAIL]: () => ok(++loads === 1 ? detail() : collectedDetail()),
      [COLLECT]: () => fail(409, 'Nothing is due', { code: 'nothing_due' }),
    })
    renderApp(PATH)
    const user = ui()
    await user.click(await screen.findByRole('button', { name: 'تأكيد التحصيل' }))
    await user.click(screen.getByRole('button', { name: 'نعم، تم الاستلام' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('لا يوجد مبلغ مستحق في هذا الكشف')
    expect(await screen.findByText('تم تحصيل هذا الكشف بالكامل.')).toBeInTheDocument()
    expect(server.to(DETAIL).length).toBeGreaterThanOrEqual(2)
  })

  it('no connection: keeps the form open so it can be sent again', async () => {
    let attempt = 0
    const server = serve({
      [COLLECT]: (call) => (++attempt === 1 ? networkDown(call) : ok(collectedDetail())),
    })
    renderApp(PATH)
    const user = ui()
    await user.click(await screen.findByRole('button', { name: 'تأكيد التحصيل' }))
    await user.type(screen.getByLabelText('ملاحظة (اختياري)'), 'ملاحظة')
    await user.click(screen.getByRole('button', { name: 'نعم، تم الاستلام' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('تعذّر الاتصال بالخادم')
    expect(screen.getByRole('form')).toBeInTheDocument()
    expect(screen.getByLabelText('ملاحظة (اختياري)')).toHaveValue('ملاحظة')

    await user.click(screen.getByRole('button', { name: 'نعم، تم الاستلام' }))
    expect(await screen.findByRole('status')).toHaveTextContent('تم تسجيل التحصيل.')
    expect(server.to(COLLECT)).toHaveLength(2)
  })

  it('a refusal by the server is shown in Arabic, never in English', async () => {
    serve({ [COLLECT]: () => fail(403, 'You do not have permission to perform this action.') })
    renderApp(PATH)
    const user = ui()
    await user.click(await screen.findByRole('button', { name: 'تأكيد التحصيل' }))
    await user.click(screen.getByRole('button', { name: 'نعم، تم الاستلام' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('ليس لديك صلاحية لهذا الإجراء.')
    expect(alert.textContent).not.toContain('permission')
  })
})

describe('extending the week', () => {
  it('asks first and shows the date it will become', async () => {
    const server = serve()
    renderApp(PATH)

    await ui().click(await screen.findByRole('button', { name: 'تمديد أسبوع واحد' }))

    const form = screen.getByRole('form', { name: 'تمديد أسبوع واحد' })
    expect(form).toHaveTextContent('سيصبح موعد التحصيل')
    expect(within(form).getByText('7 نوفمبر 2026')).toBeInTheDocument()
    expect(form).toHaveTextContent('يمكن التمديد مرة واحدة فقط لكل أسبوع.')
    expect(server.to(EXTEND)).toHaveLength(0)
  })

  it('extends, shows the new date, and disables a second extension', async () => {
    const extended = detail({ extended: true, due_date: '2026-11-07' })
    const server = serve({ [EXTEND]: () => ok(extended) })
    const { queryClient } = renderApp(PATH)
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const user = ui()

    await user.click(await screen.findByRole('button', { name: 'تمديد أسبوع واحد' }))
    await user.type(screen.getByLabelText('ملاحظة (اختياري)'), 'زيارة صالونات أخرى')
    await user.click(screen.getByRole('button', { name: 'تمديد' }))

    expect(await screen.findByRole('status')).toHaveTextContent('تم تمديد موعد التحصيل إلى 7 نوفمبر 2026.')
    expect(server.to(EXTEND)[0].body).toEqual({ note: 'زيارة صالونات أخرى' })
    expect(within(screen.getByRole('status')).queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('ممدّد')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'تمديد أسبوع واحد' })).toBeDisabled()
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['collections', 'list'] })
  })

  it('cancelling sends nothing', async () => {
    const server = serve()
    renderApp(PATH)
    const user = ui()
    await user.click(await screen.findByRole('button', { name: 'تمديد أسبوع واحد' }))
    await user.click(screen.getByRole('button', { name: 'إلغاء' }))
    expect(server.to(EXTEND)).toHaveLength(0)
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
  })

  it('already extended elsewhere: says so and reloads', async () => {
    let loads = 0
    serve({
      [DETAIL]: () => ok(++loads === 1 ? detail() : detail({ extended: true, due_date: '2026-11-07' })),
      [EXTEND]: () => fail(409, 'Already extended', { code: 'already_extended' }),
    })
    renderApp(PATH)
    const user = ui()
    await user.click(await screen.findByRole('button', { name: 'تمديد أسبوع واحد' }))
    await user.click(screen.getByRole('button', { name: 'تمديد' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('تم تمديد هذا الأسبوع من قبل')
    await waitFor(() => expect(screen.getByRole('button', { name: 'تمديد أسبوع واحد' })).toBeDisabled())
  })

  it('collecting an extended statement still works', async () => {
    serve({
      [DETAIL]: () => ok(detail({ extended: true, due_date: '2026-11-07' })),
      [COLLECT]: () => ok(collectedDetail()),
    })
    renderApp(PATH)
    const user = ui()
    await user.click(await screen.findByRole('button', { name: 'تأكيد التحصيل' }))
    await user.click(screen.getByRole('button', { name: 'نعم، تم الاستلام' }))
    expect(await screen.findByRole('status')).toBeInTheDocument()
  })
})

describe('line details', () => {
  it('shows a line collected with no collector name without breaking', async () => {
    serve({
      [DETAIL]: () =>
        ok(
          detail({
            collections: [line({ status: 'COLLECTED', collected_at: '2026-11-02T10:00:00Z', collected_by: null })],
          }),
        ),
    })
    renderApp(PATH)
    const row = within(await screen.findByRole('table')).getAllByRole('row')[1]
    expect(within(row).getByText('تم التحصيل')).toBeInTheDocument()
    expect(row.textContent).not.toContain('null')
  })
})

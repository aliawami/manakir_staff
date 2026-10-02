import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fail, fakeApi, ok } from '../test/fakeApi'
import type { Handler } from '../test/fakeApi'
import { renderApp } from '../test/renderApp'
import { NO_TOOLS, REVIEWER, staffServer } from '../test/staffServer'

const DAY = 24 * 60 * 60 * 1000
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString()

const LIST = 'GET staff/merchant-applications/'

function application(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    status: 'SUBMITTED',
    name: 'Glow Salon',
    name_ar: 'صالون جلو',
    applicant: { id: 5, full_name: 'Noura Alqahtani', phone_number: '0555000111' },
    resubmission_count: 0,
    submitted_at: daysAgo(3),
    updated_at: daysAgo(3),
    decided_at: null,
    correction_deadline: null,
    ...overrides,
  }
}

function pageOf(results: object[], count = results.length, page = 1) {
  return { count, page, page_size: 20, results }
}

function serverWith(list: Handler, me: object = REVIEWER, extra: Record<string, Handler> = {}) {
  return staffServer({ [LIST]: list, ...extra }, me)
}

const listOf = (results: object[], count = results.length): Handler => () => ok(pageOf(results, count))

describe('rows', () => {
  it('shows merchant (both languages), applicant name and phone, status, date and age', async () => {
    serverWith(listOf([application()]))
    renderApp('/applications')

    const row = (await screen.findByRole('link', { name: 'Glow Salon' })).closest('tr')!
    expect(within(row).getByText('صالون جلو')).toBeInTheDocument()
    expect(within(row).getByText('Noura Alqahtani')).toBeInTheDocument()
    expect(within(row).getByText('0555000111')).toBeInTheDocument()
    expect(within(row).getByText('Waiting for review')).toBeInTheDocument()
    expect(within(row).getByText('3 days ago')).toBeInTheDocument()
  })

  it('Arabic text is marked dir="auto" and phone numbers dir="ltr"', async () => {
    serverWith(listOf([application()]))
    renderApp('/applications')

    const arabic = await screen.findByText('صالون جلو')
    expect(arabic).toHaveAttribute('dir', 'auto')
    expect(screen.getByText('0555000111')).toHaveAttribute('dir', 'ltr')
  })

  it('an applicant with a blank name shows the phone number alone', async () => {
    serverWith(
      listOf([application({ applicant: { id: 6, full_name: ' ', phone_number: '0555999888' } })]),
    )
    renderApp('/applications')

    const row = (await screen.findByRole('link', { name: 'Glow Salon' })).closest('tr')!
    expect(within(row).getByText('0555999888')).toBeInTheDocument()
    expect(within(row).queryByText('undefined')).not.toBeInTheDocument()
    expect(row.querySelectorAll('td')[1].textContent).toBe('0555999888')
  })

  it('a merchant with only an Arabic name still has a link', async () => {
    serverWith(listOf([application({ name: '', name_ar: 'صالون ريم' })]))
    renderApp('/applications')
    expect(await screen.findByRole('link', { name: 'صالون ريم' })).toBeInTheDocument()
  })

  it('marks a resubmitted application, so the old "submitted" date is not misleading', async () => {
    serverWith(listOf([application({ resubmission_count: 2, submitted_at: daysAgo(10) })]))
    renderApp('/applications')
    expect(await screen.findByText(/10 days ago · resubmitted ×2/)).toBeInTheDocument()
  })

  it('a RETURNED application shows when it will close', async () => {
    serverWith(
      listOf([application({ status: 'RETURNED', correction_deadline: '2026-01-14T23:30:00Z' })]),
    )
    renderApp('/applications?status=RETURNED')
    const row = (await screen.findByRole('link', { name: 'Glow Salon' })).closest('tr')!
    expect(within(row).getByText('Returned to applicant')).toBeInTheDocument()
    expect(within(row).getByText('Closes 15 Jan 2026')).toBeInTheDocument()
  })

  it('shows "Closes" only for a RETURNED application', async () => {
    serverWith(listOf([application({ status: 'APPROVED', correction_deadline: '2026-01-14T23:30:00Z' })]))
    renderApp('/applications?status=APPROVED')
    await screen.findByRole('link', { name: 'Glow Salon' })
    expect(screen.queryByText(/Closes/)).not.toBeInTheDocument()
  })

  it('a row opens its application', async () => {
    const user = userEvent.setup()
    serverWith(listOf([application({ id: 42 })]), REVIEWER, {
      'GET staff/merchant-applications/42/': () => ok({ ...application({ id: 42 }), documents: [], history: [] }),
    })
    renderApp('/applications')

    await user.click(await screen.findByRole('link', { name: 'Glow Salon' }))

    expect(await screen.findByRole('heading', { name: /Glow Salon/ })).toBeInTheDocument()
  })
})

describe('what is requested', () => {
  it('by default: waiting for review, oldest first, page 1, 20 per page', async () => {
    const server = serverWith(listOf([application()]))
    renderApp('/applications')
    await screen.findByRole('link', { name: 'Glow Salon' })

    const q = server.to(LIST)[0].query
    expect(Object.fromEntries(q)).toEqual({
      status: 'SUBMITTED',
      ordering: 'oldest',
      page: '1',
      page_size: '20',
    })
  })

  it('"/" sends a reviewer to the queue', async () => {
    const server = serverWith(listOf([application()]))
    renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Applications' })).toBeInTheDocument()
    expect(server.to(LIST)).toHaveLength(1)
  })

  it('changing the status asks for that status, from page 1', async () => {
    const user = userEvent.setup()
    const server = serverWith(listOf([application()]))
    renderApp('/applications')
    await screen.findByRole('link', { name: 'Glow Salon' })

    await user.selectOptions(screen.getByLabelText('Status'), 'RETURNED')

    await waitFor(() => expect(server.to(LIST).at(-1)!.query.get('status')).toBe('RETURNED'))
    expect(server.to(LIST).at(-1)!.query.get('page')).toBe('1')
  })

  it('"All" sends no status at all', async () => {
    const user = userEvent.setup()
    const server = serverWith(listOf([application()]))
    renderApp('/applications')
    await screen.findByRole('link', { name: 'Glow Salon' })

    await user.selectOptions(screen.getByLabelText('Status'), 'all')

    await waitFor(() => expect(server.to(LIST)).toHaveLength(2))
    expect(server.to(LIST).at(-1)!.query.has('status')).toBe(false)
  })

  it('changing the order asks for it', async () => {
    const user = userEvent.setup()
    const server = serverWith(listOf([application()]))
    renderApp('/applications')
    await screen.findByRole('link', { name: 'Glow Salon' })

    await user.selectOptions(screen.getByLabelText('Order'), 'newest')

    await waitFor(() => expect(server.to(LIST).at(-1)!.query.get('ordering')).toBe('newest'))
  })

  it('the URL is the starting point: a shared link opens the same view', async () => {
    const server = serverWith(listOf([application()]))
    renderApp('/applications?status=REJECTED&ordering=newest&page=2')
    await screen.findByText(/This page is empty|Glow Salon/)

    expect(Object.fromEntries(server.to(LIST)[0].query)).toMatchObject({
      status: 'REJECTED',
      ordering: 'newest',
      page: '2',
    })
    expect(screen.getByLabelText('Status')).toHaveValue('REJECTED')
    expect(screen.getByLabelText('Order')).toHaveValue('newest')
  })

  it('rubbish in the URL is not sent to the API', async () => {
    const server = serverWith(listOf([application()]))
    renderApp('/applications?status=EVIL&ordering=x&page=-3')
    await screen.findByRole('link', { name: 'Glow Salon' })

    expect(Object.fromEntries(server.to(LIST)[0].query)).toMatchObject({
      status: 'SUBMITTED',
      ordering: 'oldest',
      page: '1',
    })
  })
})

describe('pages', () => {
  const manyRows = Array.from({ length: 20 }, (_, i) => application({ id: i + 1, name: `Salon ${i + 1}` }))

  it('says which page of how many, and walks forward and back', async () => {
    const user = userEvent.setup()
    const server = serverWith(() => ok(pageOf(manyRows, 45)))
    renderApp('/applications')

    expect(await screen.findByText('Page 1 of 3 · 45 applications')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Page 2 of 3 · 45 applications')
    expect(server.to(LIST).at(-1)!.query.get('page')).toBe('2')

    await user.click(screen.getByRole('button', { name: 'Previous' }))
    await screen.findByText('Page 1 of 3 · 45 applications')
  })

  it('cannot go past the last page', async () => {
    serverWith(() => ok(pageOf(manyRows, 45, 3)))
    renderApp('/applications?page=3')
    await screen.findByText('Page 3 of 3 · 45 applications')
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled()
  })

  it('exactly 20 results is one page, not two', async () => {
    serverWith(() => ok(pageOf(manyRows, 20)))
    renderApp('/applications')
    await screen.findByText('Page 1 of 1 · 20 applications')
  })

  it('one application reads "1 application"', async () => {
    serverWith(listOf([application()]))
    renderApp('/applications')
    await screen.findByText('Page 1 of 1 · 1 application')
  })

  it('changing a filter while on page 2 goes back to page 1', async () => {
    const user = userEvent.setup()
    const server = serverWith(() => ok(pageOf(manyRows, 45, 2)))
    renderApp('/applications?page=2')
    await screen.findByText(/Page 2 of 3/)

    await user.selectOptions(screen.getByLabelText('Status'), 'APPROVED')

    await waitFor(() => expect(server.to(LIST).at(-1)!.query.get('status')).toBe('APPROVED'))
    expect(server.to(LIST).at(-1)!.query.get('page')).toBe('1')
  })

  it('keeps the old page on screen, dimmed, while the next one loads', async () => {
    const user = userEvent.setup()
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    serverWith(async (call) => {
      if (call.query.get('page') === '2') {
        await gate
        return ok(pageOf([application({ id: 99, name: 'Second Page Salon' })], 45, 2))
      }
      return ok(pageOf(manyRows, 45))
    })
    renderApp('/applications')
    await screen.findByRole('link', { name: 'Salon 1' })

    await user.click(screen.getByRole('button', { name: 'Next' }))

    // The new page has not arrived: the old rows are still there, marked busy, buttons off.
    await waitFor(() => expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true'))
    expect(screen.getByRole('link', { name: 'Salon 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()

    release()
    expect(await screen.findByRole('link', { name: 'Second Page Salon' })).toBeInTheDocument()
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'false')
  })
})

describe('empty and failing', () => {
  it('says so when nothing matches', async () => {
    serverWith(listOf([]))
    renderApp('/applications')
    expect(await screen.findByText('No applications match this filter.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('a page beyond the end offers a way back to page 1', async () => {
    const user = userEvent.setup()
    const server = serverWith((call) =>
      call.query.get('page') === '1'
        ? ok(pageOf([application()], 1))
        : ok(pageOf([], 1, Number(call.query.get('page')))),
    )
    renderApp('/applications?page=5')

    await user.click(await screen.findByRole('button', { name: 'Go to page 1' }))

    expect(await screen.findByRole('link', { name: 'Glow Salon' })).toBeInTheDocument()
    expect(server.to(LIST).at(-1)!.query.get('page')).toBe('1')
  })

  it('shows the server message on a refusal, asks once only, and Try again recovers', async () => {
    const user = userEvent.setup()
    let allowed = false
    const server = serverWith(() =>
      allowed ? ok(pageOf([application()])) : fail(403, 'You do not have permission to do that.', null),
    )
    renderApp('/applications')

    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission to do that.')
    expect(server.to(LIST)).toHaveLength(1) // a 403 is not retried

    allowed = true
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('link', { name: 'Glow Salon' })).toBeInTheDocument()
  })

  it('a server error is retried once, then shown', async () => {
    const server = serverWith(() => fail(500, 'Something went wrong. Reference: ab12cd34'))
    renderApp('/applications')

    expect(await screen.findByRole('alert')).toHaveTextContent('Reference: ab12cd34')
    expect(server.to(LIST)).toHaveLength(2)
  })
})

describe('permissions in the menu and routes', () => {
  it('a reviewer sees the Applications link', async () => {
    serverWith(listOf([application()]))
    renderApp('/applications')
    expect(await screen.findByRole('link', { name: 'Applications' })).toBeInTheDocument()
  })

  it('someone without the permission gets no link, "Not allowed", and no request for the data', async () => {
    const server = serverWith(listOf([application()]), NO_TOOLS)
    renderApp('/applications')

    expect(await screen.findByRole('heading', { name: 'Not allowed' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Applications' })).not.toBeInTheDocument()
    expect(server.to(LIST)).toHaveLength(0)
  })

  it('the same goes for the detail screen', async () => {
    serverWith(listOf([]), NO_TOOLS)
    renderApp('/applications/7')
    expect(await screen.findByRole('heading', { name: 'Not allowed' })).toBeInTheDocument()
  })

  it('"/" shows the plain welcome screen to someone without the permission', async () => {
    serverWith(listOf([]), NO_TOOLS)
    renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Welcome' })).toBeInTheDocument()
  })
})

describe('signing in and out', () => {
  it('after signing in, comes back to the same filtered view (query string kept)', async () => {
    const user = userEvent.setup()
    const server = fakeApi({
      'POST otp-request/': () => ok({ message: 'sent' }),
      'POST otp-verify/': () => ok({ access: 'ACCESS-1', refresh: 'REFRESH-1' }),
      'GET staff/me/': () => ok(REVIEWER),
      [LIST]: listOf([application()]),
    })
    renderApp('/applications?status=RETURNED&page=2')

    await user.type(await screen.findByLabelText('Phone number'), '0500000001')
    await user.click(screen.getByRole('button', { name: 'Send code' }))
    await user.type(await screen.findByLabelText('Code'), '123456')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await screen.findByRole('heading', { name: 'Applications' })
    expect(server.to(LIST)[0].query.get('status')).toBe('RETURNED')
    expect(server.to(LIST)[0].query.get('page')).toBe('2')
  })

  it('the next person to sign in never sees the previous person\'s cached queue', async () => {
    const user = userEvent.setup()
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    let listCalls = 0
    const server = serverWith(
      async () => {
        listCalls += 1
        if (listCalls === 1) return ok(pageOf([application({ name: 'Secret Salon' })]))
        await gate // the second sign-in's list is slow: only the cache could show something
        return ok(pageOf([application({ name: 'Other Salon' })]))
      },
      REVIEWER,
      {
        'POST logout/': () => ok({}),
        'POST otp-request/': () => ok({ message: 'sent' }),
        'POST otp-verify/': () => ok({ access: 'ACCESS-1', refresh: 'REFRESH-3' }),
      },
    )
    renderApp('/applications')
    await screen.findByRole('link', { name: 'Secret Salon' })

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    await user.type(await screen.findByLabelText('Phone number'), '0500000002')
    await user.click(screen.getByRole('button', { name: 'Send code' }))
    await user.type(await screen.findByLabelText('Code'), '123456')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await screen.findByText('Loading…')
    expect(screen.queryByText('Secret Salon')).not.toBeInTheDocument()

    release()
    expect(await screen.findByRole('link', { name: 'Other Salon' })).toBeInTheDocument()
    expect(server.to(LIST)).toHaveLength(2)
  })

  it('signing out empties the cache and does not trigger another request for the list', async () => {
    const user = userEvent.setup()
    const server = serverWith(listOf([application()]), REVIEWER, { 'POST logout/': () => ok({}) })
    const { queryClient } = renderApp('/applications')
    await screen.findByRole('link', { name: 'Glow Salon' })
    expect(queryClient.getQueryCache().getAll().length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    await screen.findByLabelText('Phone number')

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(server.to(LIST)).toHaveLength(1)
  })

  it('signing in always starts from an empty cache', async () => {
    const user = userEvent.setup()
    fakeApi({
      'POST otp-request/': () => ok({ message: 'sent' }),
      'POST otp-verify/': () => ok({ access: 'ACCESS-1', refresh: 'REFRESH-1' }),
      'GET staff/me/': () => ok(NO_TOOLS), // no list request is made, so only a clear can empty the cache
    })
    const { queryClient } = renderApp('/sign-in')
    queryClient.setQueryData(['applications', 'list', 'left-over'], { secret: true })

    await user.type(await screen.findByLabelText('Phone number'), '0500000002')
    await user.click(screen.getByRole('button', { name: 'Send code' }))
    await user.type(await screen.findByLabelText('Code'), '123456')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await screen.findByRole('heading', { name: 'Welcome' })

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })

  it('when the server ends the session mid-use, goes to sign-in and forgets the data', async () => {
    const user = userEvent.setup()
    let expired = false
    const server = serverWith(
      () => (expired ? fail(401, 'expired') : ok(pageOf([application({ name: 'Secret Salon' })]))),
      REVIEWER,
      // the refresh token is refused once the session is "over"
      { 'POST token/refresh/': () => (expired ? fail(401, 'blacklisted') : ok({ access: 'ACCESS-1', refresh: 'REFRESH-2' })) },
    )
    const { queryClient } = renderApp('/applications')
    await screen.findByRole('link', { name: 'Secret Salon' })

    expired = true
    // a refocus/refetch happens; here the Status change makes a new request
    await user.selectOptions(screen.getByLabelText('Status'), 'RETURNED')

    expect(await screen.findByLabelText('Phone number')).toBeInTheDocument()
    expect(screen.queryByText('Secret Salon')).not.toBeInTheDocument()
    expect(server.to('POST token/refresh/').length).toBeGreaterThan(0)
    // the page is gone either way; what matters is that nothing stays cached for the next person
    await waitFor(() => expect(JSON.stringify(queryClient.getQueryCache().getAll().map((q) => q.state.data))).not.toContain('Secret Salon'))
  })
})

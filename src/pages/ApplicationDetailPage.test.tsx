import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { fail, ok } from '../test/fakeApi'
import type { Handler } from '../test/fakeApi'
import { fakeBlobUrls } from '../test/blobUrls'
import { renderApp } from '../test/renderApp'
import { NO_TOOLS, OVERSIGHT, REVIEWER, staffServer } from '../test/staffServer'

const DAY = 24 * 60 * 60 * 1000
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString()

const APP = 'GET staff/merchant-applications/7/'
const DOC = (id: number) => `GET staff/merchant-applications/7/documents/${id}/`

const blobs = { current: null as ReturnType<typeof fakeBlobUrls> | null }
afterEach(() => blobs.current?.restore())
function withBlobUrls() {
  blobs.current = fakeBlobUrls()
  return blobs.current
}

function document(overrides: Record<string, unknown> = {}) {
  return {
    id: 3,
    kind: 'NATIONAL_ID',
    original_name: 'id-card.png',
    content_type: 'image/png',
    size: 204800,
    uploaded_at: '2026-01-10T09:00:00Z',
    is_current: true,
    superseded_at: null,
    ...overrides,
  }
}

function detail(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    status: 'SUBMITTED',
    name: 'Glow Salon',
    name_ar: 'صالون جلو',
    applicant: { id: 5, full_name: 'Noura Alqahtani', phone_number: '0555000111' },
    resubmission_count: 0,
    submitted_at: daysAgo(4),
    updated_at: daysAgo(4),
    decided_at: null,
    correction_deadline: null,
    national_address: 'حي الشاطئ، القطيف 32611',
    decision_reason: '',
    decided_by: null,
    salon: null,
    documents: [document()],
    history: [],
    ...overrides,
  }
}

// (A string body: the test environment's Blob and the server stand-in's Response do not mix.)
const file = (type: string, content = 'bytes'): Handler => () =>
  new Response(content, { status: 200, headers: { 'Content-Type': type } })

function open(app: object = detail(), extra: Record<string, Handler> = {}, me: object = REVIEWER) {
  return staffServer({ [APP]: () => ok(app), ...extra }, me)
}

describe('overview', () => {
  it('shows the merchant, the applicant with name and phone, the address and the age', async () => {
    open()
    renderApp('/applications/7')

    expect(await screen.findByRole('heading', { name: /Glow Salon/ })).toBeInTheDocument()
    expect(screen.getByText('صالون جلو')).toHaveAttribute('dir', 'auto')
    expect(screen.getByText('Noura Alqahtani')).toBeInTheDocument()
    expect(screen.getByText('0555000111')).toHaveAttribute('dir', 'ltr')
    expect(screen.getByText('حي الشاطئ، القطيف 32611')).toHaveAttribute('dir', 'auto')
    expect(screen.getByText('(4 days ago)')).toBeInTheDocument()
    expect(screen.getAllByText('Waiting for review').length).toBeGreaterThan(0)
  })

  it('an account with no name says so and tells Hussain to call', async () => {
    open(detail({ applicant: { id: 6, full_name: ' ', phone_number: '0555999888' } }))
    renderApp('/applications/7')

    expect(await screen.findByText('No name on the account')).toBeInTheDocument()
    expect(screen.getByText('0555999888')).toBeInTheDocument()
    expect(screen.getByText(/Call her on this number/)).toBeInTheDocument()
  })

  it('a RETURNED application shows when it closes', async () => {
    open(
      detail({
        status: 'RETURNED',
        correction_deadline: '2026-01-14T23:30:00Z',
        decided_at: daysAgo(1),
        decided_by: { id: 9, full_name: 'Hussain Reviewer' },
        decision_reason: 'The certificate is blurry.',
      }),
    )
    renderApp('/applications/7')

    expect(await screen.findByText(/closes automatically on 15 Jan 2026/)).toBeInTheDocument()
    expect(screen.getByText('The certificate is blurry.')).toHaveAttribute('dir', 'auto')
    expect(screen.getByText(/· Hussain Reviewer/)).toBeInTheDocument()
  })

  it('an automatically closed application says it was the system, not a person', async () => {
    open(detail({ status: 'REJECTED', decided_at: daysAgo(1), decided_by: null }))
    renderApp('/applications/7')
    expect(await screen.findByText(/automatically \(no correction in time\)/)).toBeInTheDocument()
  })

  it('an approved application mentions the salon that was created', async () => {
    open(
      detail({
        status: 'APPROVED',
        decided_at: daysAgo(1),
        decided_by: { id: 9, full_name: 'Hussain Reviewer' },
        salon: 31,
      }),
    )
    renderApp('/applications/7')
    expect(await screen.findByText(/Salon #31 was created \(draft\)/)).toBeInTheDocument()
  })
})

describe('not found and errors', () => {
  it('an unknown application says so', async () => {
    staffServer({ [APP]: () => fail(404, 'Not found') })
    renderApp('/applications/7')
    expect(await screen.findByRole('heading', { name: 'Application not found' })).toBeInTheDocument()
  })

  it('a nonsense id is "not found" without asking the server', async () => {
    const server = staffServer({})
    renderApp('/applications/abc')
    expect(await screen.findByRole('heading', { name: 'Application not found' })).toBeInTheDocument()
    expect(server.calls.filter((c) => c.path.startsWith('staff/merchant-applications'))).toHaveLength(0)
  })

  it('a server error is retried once, then shown with Try again', async () => {
    const server = staffServer({ [APP]: () => fail(500, 'Something went wrong. Reference: ab12cd34') })
    renderApp('/applications/7')
    expect(await screen.findByRole('alert')).toHaveTextContent('Reference: ab12cd34')
    expect(server.to(APP)).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})

describe('documents list', () => {
  it('lists type, name, size and date, and marks a replaced file', async () => {
    open(
      detail({
        documents: [
          document({ id: 3, original_name: 'old-id.png', is_current: false, superseded_at: '2026-01-12T10:00:00Z' }),
          document({ id: 4, original_name: 'new-id.png' }),
          document({ id: 5, kind: 'CERTIFICATE', original_name: 'cr.pdf', content_type: 'application/pdf', size: 2 * 1024 * 1024 }),
        ],
      }),
    )
    renderApp('/applications/7')

    await screen.findByText('new-id.png')
    const old = screen.getByText('old-id.png').closest('tr')!
    expect(within(old).getByText('Replaced on 12 Jan 2026')).toBeInTheDocument()
    expect(within(screen.getByText('new-id.png').closest('tr')!).queryByText(/Replaced/)).not.toBeInTheDocument()
    const cert = screen.getByText('cr.pdf').closest('tr')!
    expect(within(cert).getByText('2.0 MB')).toBeInTheDocument()
    expect(within(cert).getByText('Certificate')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Open' })).toHaveLength(3)
  })

  it('says so when there are none', async () => {
    open(detail({ documents: [] }))
    renderApp('/applications/7')
    expect(await screen.findByText('No documents.')).toBeInTheDocument()
  })

  it('a role without the documents permission gets no Open buttons and no request', async () => {
    const server = open(detail(), {}, OVERSIGHT)
    renderApp('/applications/7')

    await screen.findByText('id-card.png')
    expect(screen.queryByRole('button', { name: 'Open' })).not.toBeInTheDocument()
    expect(screen.getByText(/Your role cannot open documents/)).toBeInTheDocument()
    expect(server.calls.filter((c) => c.path.includes('/documents/'))).toHaveLength(0)
  })
})

describe('opening a document', () => {
  it('fetches the file with the Authorization header and shows an image', async () => {
    const user = userEvent.setup()
    const urls = withBlobUrls()
    const server = open(detail(), { [DOC(3)]: file('image/png') })
    renderApp('/applications/7')

    await user.click(await screen.findByRole('button', { name: 'Open' }))

    const image = await screen.findByRole('img')
    expect(image).toHaveAttribute('src', 'blob:test-1')
    expect(screen.getByText(/recorded in the audit log/)).toBeInTheDocument()
    expect(server.to(DOC(3))).toHaveLength(1)
    expect(server.to(DOC(3))[0].headers.Authorization).toBe('Bearer ACCESS-1')
    expect(urls.created[0].type).toBe('image/png')
    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute('download', 'id-card.png')
  })

  it('shows a PDF in a frame', async () => {
    const user = userEvent.setup()
    withBlobUrls()
    open(detail({ documents: [document({ id: 5, original_name: 'cr.pdf', content_type: 'application/pdf' })] }), {
      [DOC(5)]: file('application/pdf'),
    })
    renderApp('/applications/7')

    await user.click(await screen.findByRole('button', { name: 'Open' }))

    const frame = await screen.findByTitle('National ID (PDF)')
    expect(frame.tagName).toBe('IFRAME')
    expect(frame).toHaveAttribute('src', 'blob:test-1')
  })

  it('never shows an unexpected type inside the page (HTML would run in our origin)', async () => {
    const user = userEvent.setup()
    const urls = withBlobUrls()
    open(detail(), { [DOC(3)]: file('text/html', '<script>steal()</script>') })
    renderApp('/applications/7')

    await user.click(await screen.findByRole('button', { name: 'Open' }))

    expect(await screen.findByText(/cannot be shown here/)).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(window.document.querySelector('iframe')).toBeNull()
    expect(urls.created[0].type).toBe('application/octet-stream')
  })

  it('SVG is not an image to us either', async () => {
    const user = userEvent.setup()
    withBlobUrls()
    open(detail(), { [DOC(3)]: file('image/svg+xml', '<svg onload="x()"/>') })
    renderApp('/applications/7')

    await user.click(await screen.findByRole('button', { name: 'Open' }))

    expect(await screen.findByText(/cannot be shown here/)).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('the shown type is the checked one (parameters stripped, case folded)', async () => {
    const user = userEvent.setup()
    const urls = withBlobUrls()
    open(detail(), { [DOC(3)]: file('Image/PNG; charset=binary') })
    renderApp('/applications/7')

    await user.click(await screen.findByRole('button', { name: 'Open' }))

    await screen.findByRole('img')
    expect(urls.created[0].type).toBe('image/png')
  })

  it('closing gives the file back (revokes the URL) and removes it from the page', async () => {
    const user = userEvent.setup()
    const urls = withBlobUrls()
    open(detail(), { [DOC(3)]: file('image/png') })
    renderApp('/applications/7')
    await user.click(await screen.findByRole('button', { name: 'Open' }))
    await screen.findByRole('img')

    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(urls.revoked).toContain('blob:test-1')
  })

  it('opening a second document replaces the first and revokes its URL', async () => {
    const user = userEvent.setup()
    const urls = withBlobUrls()
    open(detail({ documents: [document({ id: 3 }), document({ id: 4, original_name: 'second.png' })] }), {
      [DOC(3)]: file('image/png'),
      [DOC(4)]: file('image/png'),
    })
    renderApp('/applications/7')
    const buttons = await screen.findAllByRole('button', { name: 'Open' })
    await user.click(buttons[0])
    await screen.findByRole('img')

    await user.click(screen.getAllByRole('button', { name: 'Open' })[1])

    await waitFor(() => expect(urls.created).toHaveLength(2))
    expect(urls.revoked).toEqual(['blob:test-1'])
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })

  it('leaving the screen (signing out) revokes the URL too', async () => {
    const user = userEvent.setup()
    const urls = withBlobUrls()
    open(detail(), { [DOC(3)]: file('image/png'), 'POST logout/': () => ok({}) })
    renderApp('/applications/7')
    await user.click(await screen.findByRole('button', { name: 'Open' }))
    await screen.findByRole('img')

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    await screen.findByLabelText('Phone number')

    expect(urls.revoked).toContain('blob:test-1')
  })

  it('a missing file is shown by name, and nothing is displayed', async () => {
    const user = userEvent.setup()
    withBlobUrls()
    open(detail(), { [DOC(3)]: () => fail(404, 'The file is missing from storage.') })
    renderApp('/applications/7')

    await user.click(await screen.findByRole('button', { name: 'Open' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not open id-card.png: The file is missing from storage.',
    )
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('a 403 from the server is shown even though the button was visible', async () => {
    const user = userEvent.setup()
    withBlobUrls()
    open(detail(), { [DOC(3)]: () => fail(403, 'You do not have permission to do that.') })
    renderApp('/applications/7')

    await user.click(await screen.findByRole('button', { name: 'Open' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission to do that.')
  })

  it('a double click asks the server once (every request is an audit entry)', async () => {
    const user = userEvent.setup()
    withBlobUrls()
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const server = open(detail(), {
      [DOC(3)]: async (call) => {
        await gate
        return file('image/png')(call)
      },
    })
    renderApp('/applications/7')

    await user.click(await screen.findByRole('button', { name: 'Open' }))
    const busy = await screen.findByRole('button', { name: 'Opening…' })
    expect(busy).toBeDisabled()
    await user.click(busy)

    release()
    await screen.findByRole('img')
    expect(server.to(DOC(3))).toHaveLength(1)
  })

  it('refocusing the window does NOT fetch the file again', async () => {
    const user = userEvent.setup()
    withBlobUrls()
    const server = open(detail(), { [DOC(3)]: file('image/png') })
    renderApp('/applications/7')
    await user.click(await screen.findByRole('button', { name: 'Open' }))
    await screen.findByRole('img')

    window.dispatchEvent(new Event('focus'))
    window.document.dispatchEvent(new Event('visibilitychange'))
    await new Promise((r) => setTimeout(r, 50))

    expect(server.to(DOC(3))).toHaveLength(1)
  })

  it('a server error while opening is not retried automatically', async () => {
    const user = userEvent.setup()
    withBlobUrls()
    const server = open(detail(), { [DOC(3)]: () => fail(500, 'Something went wrong.') })
    renderApp('/applications/7')

    await user.click(await screen.findByRole('button', { name: 'Open' }))
    await screen.findByRole('alert')
    await new Promise((r) => setTimeout(r, 50))

    expect(server.to(DOC(3))).toHaveLength(1)
  })
})

describe('history', () => {
  it('lists each decision with who, when and the reason, and "System" for the automatic closing', async () => {
    open(
      detail({
        history: [
          {
            id: 1,
            action: 'MERCHANT_APPLICATION_RETURNED',
            actor: { id: 9, full_name: 'Hussain Reviewer' },
            created_at: '2026-01-11T10:00:00Z',
            metadata: { reason: 'اكتب العنوان الوطني كاملاً' },
          },
          {
            id: 2,
            action: 'MERCHANT_APPLICATION_AUTO_CLOSED',
            actor: null,
            created_at: '2026-01-16T10:00:00Z',
            metadata: {},
          },
        ],
      }),
    )
    renderApp('/applications/7')

    const returned = (await screen.findByText('Returned to the applicant')).closest('li')!
    expect(within(returned).getByText('Hussain Reviewer')).toBeInTheDocument()
    expect(within(returned).getByText('اكتب العنوان الوطني كاملاً')).toHaveAttribute('dir', 'auto')
    const closed = screen.getByText(/Closed automatically/).closest('li')!
    expect(within(closed).getByText('System')).toBeInTheDocument()
  })

  it('an approval shows the registration number and expiry', async () => {
    open(
      detail({
        history: [
          {
            id: 3,
            action: 'MERCHANT_APPLICATION_APPROVED',
            actor: { id: 9, full_name: 'Hussain Reviewer' },
            created_at: '2026-01-11T10:00:00Z',
            metadata: { registration_number: '1010123456', expiry_date: '2027-01-14' },
          },
        ],
      }),
    )
    renderApp('/applications/7')
    expect(await screen.findByText('1010123456')).toHaveAttribute('dir', 'ltr')
    expect(screen.getByText(/expires 14 Jan 2027/)).toBeInTheDocument()
  })

  it('says so when nothing has been decided yet', async () => {
    open()
    renderApp('/applications/7')
    expect(await screen.findByText('No decisions yet.')).toBeInTheDocument()
  })
})

describe('permissions and navigation', () => {
  it('without view permission: Not allowed, and no request', async () => {
    const server = open(detail(), {}, NO_TOOLS)
    renderApp('/applications/7')
    expect(await screen.findByRole('heading', { name: 'Not allowed' })).toBeInTheDocument()
    expect(server.to(APP)).toHaveLength(0)
  })

  it('"Back" returns to the same filtered queue', async () => {
    const user = userEvent.setup()
    const LIST = 'GET staff/merchant-applications/'
    const server = open(detail(), {
      [LIST]: () => ok({ count: 1, page: 1, page_size: 20, results: [detail()] }),
    })
    renderApp('/applications?status=RETURNED&ordering=newest&page=1')

    await user.click(await screen.findByRole('link', { name: 'Glow Salon' }))
    await screen.findByRole('heading', { name: /Glow Salon/ })
    await user.click(screen.getByRole('link', { name: '← Back to the queue' }))

    await screen.findByLabelText('Status')
    expect(screen.getByLabelText('Status')).toHaveValue('RETURNED')
    expect(screen.getByLabelText('Order')).toHaveValue('newest')
    expect(server.to(LIST).at(-1)!.query.get('status')).toBe('RETURNED')
  })

  it('opened directly, "Back" goes to the default queue', async () => {
    const user = userEvent.setup()
    open(detail(), {
      'GET staff/merchant-applications/': () => ok({ count: 0, page: 1, page_size: 20, results: [] }),
    })
    renderApp('/applications/7')

    await user.click(await screen.findByRole('link', { name: '← Back to the queue' }))

    expect(await screen.findByLabelText('Status')).toHaveValue('SUBMITTED')
  })
})

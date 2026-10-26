import { PERMISSIONS } from '../auth/permissions'
import { fail, fakeApi, ok } from './fakeApi'
import type { Handler } from './fakeApi'

export const REVIEWER = {
  id: 9,
  phone_number: '0500000001',
  full_name: 'Hussain Reviewer',
  roles: ['merchant_reviewer'],
  permissions: [
    'staff.access_staff_app',
    PERMISSIONS.viewApplications,
    PERMISSIONS.viewDocuments,
    PERMISSIONS.decideApplications,
  ],
}

/** Sees applications but may not open documents (the "oversight" role). */
export const OVERSIGHT = {
  ...REVIEWER,
  roles: ['oversight'],
  permissions: ['staff.access_staff_app', PERMISSIONS.viewApplications],
}

/** Collects the cash commission (the "finance" role). */
export const FINANCE = {
  ...REVIEWER,
  id: 12,
  full_name: 'Ghaith',
  roles: ['finance'],
  permissions: [
    'staff.access_staff_app',
    PERMISSIONS.viewCollections,
    PERMISSIONS.collectCommissions,
  ],
}

/** Can read the collections but not act on them. */
export const COLLECTIONS_READER = {
  ...FINANCE,
  id: 13,
  roles: [],
  permissions: ['staff.access_staff_app', PERMISSIONS.viewCollections],
}

export const NO_TOOLS = { ...REVIEWER, roles: [], permissions: ['staff.access_staff_app'] }

/**
 * A fake server where `me` is already signed in on this tab (a refresh token is
 * saved, as after a reload). `handlers` are the endpoints the test cares about.
 */
export function staffServer(handlers: Record<string, Handler>, me: object = REVIEWER) {
  sessionStorage.setItem('manakir_staff_refresh_token', 'REFRESH-1')
  return fakeApi({
    'GET staff/me/': (call) =>
      call.headers.Authorization === 'Bearer ACCESS-1' ? ok(me) : fail(401, 'Not signed in'),
    'POST token/refresh/': () => ok({ access: 'ACCESS-1', refresh: 'REFRESH-2' }),
    ...handlers,
  })
}

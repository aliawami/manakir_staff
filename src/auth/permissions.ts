/**
 * The permission names the server sends in `/staff/me/` ("app_label.codename").
 * They must match `staff/roles.py` in the API. Only used to decide what to
 * SHOW; the server checks every request on its own.
 */
export const PERMISSIONS = {
  viewApplications: 'merchant_applications.view_merchantapplication',
  viewDocuments: 'merchant_applications.view_merchantapplication_documents',
  decideApplications: 'merchant_applications.decide_merchantapplication',
  viewCollections: 'cash_collections.view_cashcollection',
  collectCommissions: 'cash_collections.collect_cashcollection',
} as const

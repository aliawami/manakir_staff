/**
 * jsdom has no URL.createObjectURL. This installs a recording stand-in:
 * `created` holds the Blobs turned into URLs, `revoked` the URLs given back.
 * Call restore() (the tests do it in afterEach via the returned object) to remove it.
 */
export function fakeBlobUrls() {
  const created: Blob[] = []
  const revoked: string[] = []
  const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL }

  URL.createObjectURL = (blob: Blob | MediaSource) => {
    created.push(blob as Blob)
    return `blob:test-${created.length}`
  }
  URL.revokeObjectURL = (url: string) => {
    revoked.push(url)
  }

  return {
    created,
    revoked,
    restore() {
      URL.createObjectURL = original.create
      URL.revokeObjectURL = original.revoke
    },
  }
}

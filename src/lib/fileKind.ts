/**
 * Which files may be shown INSIDE the page.
 *
 * A file opened from a blob URL runs in this app's own origin. A file that is
 * really HTML or SVG would then be able to run script next to the sign-in
 * token. So only the three types the server accepts at upload (PDF, JPEG,
 * PNG) are ever displayed; anything else is offered as a download only.
 */

export type InlineKind = 'pdf' | 'image'

const ALLOWED: Record<string, InlineKind> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'image',
  'image/png': 'image',
}

/** "image/PNG; charset=x" -> "image/png" */
export function normalizeType(contentType: string): string {
  return contentType.split(';')[0].trim().toLowerCase()
}

export function inlineKind(contentType: string): InlineKind | null {
  return ALLOWED[normalizeType(contentType)] ?? null
}

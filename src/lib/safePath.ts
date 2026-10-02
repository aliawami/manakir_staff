/**
 * Where to go after signing in. The value comes from our own redirect, but it
 * is still checked: only a path inside this app ("/applications?page=2") is
 * accepted. "//evil.example" (which a browser reads as another site), a full
 * URL, or anything that is not a string all become "/".
 */
export function safeLocalPath(value: unknown): string {
  if (typeof value !== 'string') return '/'
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/'
  return value
}

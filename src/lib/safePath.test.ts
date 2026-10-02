import { describe, expect, it } from 'vitest'
import { safeLocalPath } from './safePath'

describe('safeLocalPath', () => {
  it('keeps a path inside the app, with its query string', () => {
    expect(safeLocalPath('/applications?status=RETURNED&page=2')).toBe('/applications?status=RETURNED&page=2')
    expect(safeLocalPath('/')).toBe('/')
  })

  it('turns anything that could leave the app into "/"', () => {
    for (const bad of ['//evil.example', 'https://evil.example', '/\\evil.example', 'applications', '', 42, null, undefined, { a: 1 }]) {
      expect(safeLocalPath(bad), String(bad)).toBe('/')
    }
  })
})

import { describe, expect, it } from 'vitest'
import { takeAddFromUrl, type UrlWindow } from './incomingAdd'

function fakeWindow(hash: string, options: { throwOnReplace?: boolean } = {}) {
  const calls: (string | undefined)[] = []
  const win: UrlWindow = {
    location: { hash, pathname: '/app/', search: '?lang=sv' },
    history: {
      replaceState(_data, _unused, url) {
        if (options.throwOnReplace === true) throw new Error('blocked')
        calls.push(url)
      },
    },
  }
  return { win, calls }
}

describe('takeAddFromUrl', () => {
  it('returns the payload and removes the fragment, keeping path and query', () => {
    const { win, calls } = fakeWindow('#add=1&v=1&u=https%3A%2F%2Fa.se%2Fjob&jo=Acme')
    const result = takeAddFromUrl(win)
    expect(result).toEqual({ kind: 'prefill', prefill: { link: 'https://a.se/job', company: 'Acme', role: '' } })
    expect(calls).toEqual(['/app/?lang=sv'])
  })

  it('also removes a payload it cannot use, and says so', () => {
    const { win, calls } = fakeWindow('#add=1&v=2&u=https%3A%2F%2Fa.se')
    expect(takeAddFromUrl(win)).toEqual({ kind: 'invalid' })
    expect(calls).toEqual(['/app/?lang=sv'])
  })

  it('leaves an address without a payload alone', () => {
    const { win, calls } = fakeWindow('#section')
    expect(takeAddFromUrl(win)).toBeNull()
    expect(calls).toEqual([])
  })

  it('still returns the payload when the address cannot be changed', () => {
    const { win } = fakeWindow('#add=1&v=1&u=https%3A%2F%2Fa.se%2Fjob', { throwOnReplace: true })
    expect(takeAddFromUrl(win)?.kind).toBe('prefill')
  })
})

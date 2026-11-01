import { noticeText, renderDigest, type Notice } from './lib'

const n = (o: Partial<Notice> = {}): Notice => ({
  kind: 'driver_challan',
  severity: 'warning',
  title: 'Driver paid a challan',
  meta: { code: 'TRP-2026-0030', kind: 'challan', amount: 2000, note: 'No-entry, Jaipur' },
  link: '/trips/abc',
  createdAt: '2026-11-01T05:00:00Z',
  ...o,
})

describe('notification email', () => {
  it('words each notice in the owner language', () => {
    expect(noticeText(n(), 'en')).toBe('Driver paid challan ₹2,000 — TRP-2026-0030 No-entry, Jaipur')
    expect(noticeText(n(), 'hi')).toContain('चालान ₹2,000')
    expect(noticeText(n({ kind: 'something_new', title: 'Fallback <b>' }), 'en')).toBe('Fallback <b>')
  })

  it('one email for many, newest first, links into the app, names escaped', () => {
    const mail = renderDigest(
      [n(), n({ kind: 'trip_done', severity: 'info', meta: { code: 'TRP-2026-0031' }, createdAt: '2026-11-01T06:00:00Z' })],
      'en',
      'Agresh <b>',
      'Agrawal Transport',
      'https://spareway.vercel.app',
    )
    expect(mail.subject).toBe('Spareway: 2 important updates')
    expect(mail.html.indexOf('TRP-2026-0031 finished')).toBeLessThan(mail.html.indexOf('Driver paid'))
    expect(mail.html).toContain('https://spareway.vercel.app/trips/abc')
    expect(mail.html).toContain('Agresh &lt;b&gt;')
    expect(renderDigest([n()], 'en', '', 'X', 'https://a.b').subject).toContain('Spareway: Driver paid challan')
  })
})

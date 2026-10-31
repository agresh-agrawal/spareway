import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { queryKeys } from '@/lib/queryKeys'
import { sortProblems } from './lib/problems'

vi.mock('./api', () => ({ resolveAlert: vi.fn(async () => {}) }))
vi.mock('@/lib/realtime', () => ({ useRealtime: () => {} }))

describe('problems', () => {
  it('sorts critical → warning → info, newest first', () => {
    const a = (id: string, severity: string, created_at: string) => ({ id, severity, created_at })
    const sorted = sortProblems([
      a('info', 'info', '2026-10-30T10:00:00Z'),
      a('warn', 'warning', '2026-10-30T09:00:00Z'),
      a('crit-old', 'critical', '2026-10-30T08:00:00Z'),
      a('crit-new', 'critical', '2026-10-30T09:30:00Z'),
    ])
    expect(sorted.map((x) => x.id)).toEqual(['crit-new', 'crit-old', 'warn', 'info'])
  })

  it('"Done" removes the problem at once and invalidates alerts', async () => {
    const { useResolveProblem } = await import('./hooks')
    const qc = new QueryClient()
    const key = queryKeys.alerts(true)
    qc.setQueryData(key, [
      { id: '1', severity: 'critical', created_at: '' },
      { id: '2', severity: 'info', created_at: '' },
    ])
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useResolveProblem(), { wrapper })
    act(() => result.current.mutate('1'))
    await waitFor(() => expect((qc.getQueryData(key) as { id: string }[]).map((x) => x.id)).toEqual(['2']))
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.alertsAll }))
  })
})

import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Download, History, IndianRupee, ReceiptIndianRupee, Route as RouteIcon } from 'lucide-react'
import { BigTile, Card, EmptyState, ErrorState, PageHeader, PlainButton, SelectField, SkeletonList } from '@/components/common'
import { useLang } from '@/lib/i18n'
import { formatDate, formatInr, formatKm } from '@/lib/format'
import { cn } from '@/lib/cn'
import { listHistory } from '../api'
import { historyCsv, historyTotals, monthOf, pastTrips } from '../lib/history'

export default function HistoryPage() {
  const { t, td, lang } = useLang('history')
  const q = useQuery({ queryKey: ['history'], queryFn: listHistory })
  const [month, setMonth] = useState('all')
  const past = useMemo(() => pastTrips(q.data ?? []), [q.data])
  const months = useMemo(() => [...new Set(past.map(monthOf).filter(Boolean))], [past])
  const shown = month === 'all' ? past : past.filter((r) => monthOf(r) === month)
  const totals = historyTotals(shown)

  const download = () => {
    const blob = new Blob(['\uFEFF' + historyCsv(q.data ?? [])], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `spareway-trips-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  const monthLabel = (m: string) => {
    const [y, mm] = m.split('-').map(Number)
    return new Date(Date.UTC(y, mm - 1, 15)).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { month: 'long', year: 'numeric' })
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <PageHeader
        title={t('title')}
        actions={
          <PlainButton icon={Download} onClick={download} disabled={!q.data?.length}>
            {t('download')}
          </PlainButton>
        }
      />
      {q.error ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.isLoading ? (
        <SkeletonList rows={4} />
      ) : past.length === 0 ? (
        <EmptyState icon={History} text={t('empty')} />
      ) : (
        <>
          <div className="max-w-xs">
            <SelectField
              label={t('month')}
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              options={[{ value: 'all', label: t('allMonths') }, ...months.map((m) => ({ value: m, label: monthLabel(m) }))]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <BigTile icon={RouteIcon} value={String(totals.trips)} label={t('tiles.trips')} />
            <BigTile icon={RouteIcon} value={formatKm(totals.km)} label={t('tiles.km')} />
            <BigTile icon={IndianRupee} value={formatInr(totals.netInr)} label={t('tiles.net')} />
            <BigTile icon={ReceiptIndianRupee} value={formatInr(totals.challanInr)} label={t('tiles.challans')} />
          </div>
          <ul className="flex flex-col gap-3">
            {shown.map((r) => (
              <li key={r.tripId}>
                <Link to={`/trips/${r.tripId}`} className="block">
                  <Card className="flex items-center gap-4 transition-colors hover:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-3">
                        <span className="text-[18px] font-semibold">
                          {td(r.from)} → {td(r.to)}
                        </span>
                        <span className="text-ink-2">{r.code}</span>
                      </div>
                      <p className="mt-1 text-ink-2">
                        {formatDate(r.completedAt ?? r.departure ?? '', lang)} · {r.regNo}
                        {r.driver ? ` · ${td(r.driver)}` : ''} · {formatKm(r.km)}
                      </p>
                      {r.status === 'cancelled' ? (
                        <p className="mt-1 font-semibold text-ink-2">{t('cancelled')}</p>
                      ) : (
                        r.miscInr > 0 && <p className="mt-1 text-label text-ink-2">{t('costs', { inr: formatInr(r.miscInr) })}</p>
                      )}
                    </div>
                    {r.status !== 'cancelled' && (
                      <div className="text-right">
                        <div className={cn('text-[20px] font-semibold tabular', r.netInr >= 0 ? 'text-ok' : 'text-crit')}>{formatInr(r.netInr)}</div>
                        <div className="text-label text-ink-2">{t('net')}</div>
                      </div>
                    )}
                    <ChevronRight size={20} className="shrink-0 text-ink-3" aria-hidden />
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

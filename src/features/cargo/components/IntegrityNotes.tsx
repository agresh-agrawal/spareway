import { AlertTriangle, Ban, History } from 'lucide-react'
import { useLang } from '@/lib/i18n'
import { formatWeight } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { IntegrityBlock, IntegrityFlag } from '../lib/integrity'

/** Blocks and the label flag mean the data itself is irrelevant; the rest ask for a check. */
const IRRELEVANT: string[] = ['VAGUE_LABEL']

/**
 * One plain line per problem (Design System: one-line text, no chips). Blocks stop the save; flags only warn.
 * `historyKg` adds "Usually X kg each in your past trips" when known.
 */
export function IntegrityNotes({
  blocks = [],
  flags = [],
  historyKg = null,
  className,
}: {
  blocks?: readonly (IntegrityBlock | string)[]
  flags?: readonly (IntegrityFlag | string)[]
  historyKg?: number | null
  className?: string
}) {
  const { t } = useLang('cargo')
  const usual = historyKg ? formatWeight(historyKg) : ''
  if (!blocks.length && !flags.length && !historyKg) return null
  return (
    <div className={cn('flex flex-col gap-1', className)} role={blocks.length ? 'alert' : undefined}>
      {blocks.map((b) => (
        <p key={b} className="flex items-start gap-1.5 text-label font-semibold text-crit">
          <Ban size={16} className="mt-0.5 shrink-0" aria-hidden />
          {t('integrity.irrelevant')} — {t(`integrity.blocks.${b}`)}
        </p>
      ))}
      {flags.map((f) => (
        <p
          key={f}
          className={cn(
            'flex items-start gap-1.5 text-label',
            IRRELEVANT.includes(f) ? 'font-semibold text-crit' : 'text-warn',
          )}
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          {IRRELEVANT.includes(f) ? `${t('integrity.irrelevant')} — ` : ''}
          {t(`integrity.flags.${f}`, { usual })}
        </p>
      ))}
      {historyKg && !flags.includes('HISTORY_MISMATCH') && (
        <p className="flex items-start gap-1.5 text-label text-ink-2">
          <History size={16} className="mt-0.5 shrink-0" aria-hidden />
          {t('integrity.usual', { kg: usual })}
        </p>
      )}
    </div>
  )
}

/** Error text for a refused save: impossible values read "Data looks irrelevant", a lock says why. */
export function cargoErrorKey(e: { code: string; message?: string }): string {
  const m = e.message ?? ''
  if (m.includes('CARGO_IMPOSSIBLE')) return 'cargo:integrity.errors.impossible'
  if (m.includes('CARGO_LOCKED')) return 'cargo:integrity.locked'
  if (m.includes('SLIP_NEEDED')) return 'cargo:integrity.errors.slip'
  if (m.includes('WEIGHT_TARE')) return 'cargo:integrity.errors.tare'
  return `common:errors.${e.code}`
}

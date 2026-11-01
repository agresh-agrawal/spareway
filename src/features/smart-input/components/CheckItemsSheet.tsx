import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { MainButton, NumberField, PlainButton, SelectField, Sheet, TextField } from '@/components/common'
import { useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import { cn } from '@/lib/cn'
import { checkCargo, cargoErrorKey, IntegrityNotes, type IntegrityTruck } from '@/features/cargo'
import { allValid, rowErrors, rowWarnings, type CheckRow, type RowError } from '../lib/validate'

export interface DropStop {
  id: string
  seq: number
  name: string
}

/** The same checks as the cargo form and the database guard, for one suggested row. */
export function rowIntegrity(
  r: CheckRow,
  source: string,
  truck?: IntegrityTruck | null,
  history: { label: string; weight_kg: number }[] = [],
) {
  return checkCargo(
    {
      label: r.label,
      length_cm: r.lengthCm,
      width_cm: r.widthCm,
      height_cm: r.heightCm,
      weight_kg: r.weightKg,
      quantity: Number.isFinite(r.quantity) ? r.quantity : 1,
      upright_only: r.uprightOnly,
      source,
      confidence: r.confidence,
    },
    truck,
    history,
  )
}

const numOr = (v: string) => (v.trim() === '' ? Number.NaN : Number(v.replace(',', '.')))
const show = (n: number) => (Number.isFinite(n) ? String(n) : '')

function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={cn(
        'inline-flex h-10 items-center gap-1.5 rounded-full border px-3 text-[14px] font-semibold transition-colors',
        on ? 'border-accent bg-accent/15 text-ink' : 'border-line-strong bg-surface-2 text-ink-2',
      )}
    >
      {on && <Check size={16} aria-hidden />}
      {label}
    </button>
  )
}

/** Check items (Design System 7.12): editable rows, AI badge + confidence, drop stop + kg required, "Add N items". */
export function CheckItemsSheet({
  open,
  onOpenChange,
  initial,
  stops,
  photos = [],
  ai,
  confirmLabel,
  source = 'manual',
  truck = null,
  history = [],
  onRemove,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  initial: CheckRow[]
  /** drop stops only */
  stops: DropStop[]
  photos?: string[]
  /** true for camera / AI suggestions (shows the AI badge) */
  ai: boolean
  /** button text instead of "Add N items" (editing an existing item) */
  confirmLabel?: string
  /** 'camera' / 'voice' for AI rows: low confidence then needs a check */
  source?: string
  /** the truck on the trip, for the same checks as the database */
  truck?: IntegrityTruck | null
  /** the company's earlier lines (owner only; the loader has no history) */
  history?: { label: string; weight_kg: number }[]
  /** shows "Remove item" (editing an existing item) */
  onRemove?: () => Promise<void>
  onConfirm: (rows: CheckRow[]) => Promise<void>
}) {
  const { t, td } = useLang('smart-input')
  const [rows, setRows] = useState<CheckRow[]>(initial)
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setRows(
        initial.map((r) => (!r.dropStopId && stops.length === 1 ? { ...r, dropStopId: stops[0].id } : r)),
      )
      setTried(false)
    }
  }, [open, initial]) // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (key: string, p: Partial<CheckRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)))
  const stopOptions = [
    { value: '', label: t('check.chooseDrop') },
    ...stops.map((s) => ({ value: s.id, label: `${s.seq} · ${td(s.name)}` })),
  ]
  const pieces = rows.reduce((n, r) => n + (Number.isFinite(r.quantity) ? r.quantity : 0), 0)

  const confirm = async () => {
    setTried(true)
    if (!allValid(rows)) {
      toast.error(t('check.fix'))
      return
    }
    if (rows.some((r) => rowIntegrity(r, source, truck, history).blocks.length > 0)) {
      toast.error(t('cargo:integrity.errors.impossible'))
      return
    }
    setSaving(true)
    try {
      await onConfirm(rows)
      onOpenChange(false)
    } catch (e) {
      toast.error(t(cargoErrorKey(toAppError(e))))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      dirty={rows.length > 0}
      title={t('check.title')}
      description={t('check.desc')}
      footer={
        <MainButton
          icon={Check}
          onClick={confirm}
          loading={saving}
          disabled={rows.length === 0}
          className="w-full"
        >
          {confirmLabel ?? t('check.add', { count: pieces })}
        </MainButton>
      }
    >
      <div className="flex flex-col gap-4">
        {photos.length > 0 && (
          <div className="flex gap-2">
            {photos.map((u) => (
              <img key={u} src={u} alt="" className="size-16 rounded-tile border border-line object-cover" />
            ))}
          </div>
        )}
        {ai && <p className="text-label text-ink-2">{t('check.aiNote')}</p>}
        {onRemove && (
          <PlainButton
            icon={Trash2}
            tone="danger"
            onClick={() =>
              void onRemove().catch((e) => toast.error(t(`common:errors.${toAppError(e).code}`)))
            }
          >
            {t('mine.remove')}
          </PlainButton>
        )}
        {rows.length === 0 && <p className="text-ink-2">{t('check.empty')}</p>}

        {stops.length > 1 && rows.length > 1 && (
          <SelectField
            label={t('check.dropAll')}
            options={stopOptions}
            value=""
            onChange={(e) =>
              e.target.value && setRows((rs) => rs.map((r) => ({ ...r, dropStopId: e.target.value })))
            }
          />
        )}

        {rows.map((r, i) => {
          const errs = tried ? rowErrors(r) : []
          // low confidence is already a warning line here
          const warns = rowWarnings(r)
          const integrity =
            Number.isFinite(r.weightKg) && rowErrors(r).every((e) => e !== 'size')
              ? rowIntegrity(r, source, truck, history)
              : null
          const err = (k: RowError) => (errs.includes(k) ? t(`check.errors.${k}`) : undefined)
          return (
            <section
              key={r.key}
              className="flex flex-col gap-3 rounded-tile border border-line bg-surface-2 p-3"
              aria-label={t('check.line', { n: i + 1 })}
            >
              <div className="flex items-center gap-2">
                <span className="text-label font-semibold text-ink-2">{t('check.line', { n: i + 1 })}</span>

                <span
                  className={cn('text-label font-semibold', r.confidence < 0.5 ? 'text-warn' : 'text-ink-2')}
                >
                  {t('check.sure', { pct: Math.round(r.confidence * 100) })}
                </span>
                <button
                  type="button"
                  aria-label={t('check.remove')}
                  onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                  className="ml-auto flex size-10 items-center justify-center rounded-full text-ink-2 hover:bg-surface-3 hover:text-crit"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              <TextField
                label={t('check.label')}
                value={r.label}
                error={err('label')}
                onChange={(e) => patch(r.key, { label: e.target.value })}
              />
              <div className="grid grid-cols-3 gap-2">
                {(['lengthCm', 'widthCm', 'heightCm'] as const).map((k) => (
                  <NumberField
                    key={k}
                    label={t(`check.${k.replace('Cm', '')}`)}
                    unit="cm"
                    inputMode="decimal"
                    value={show(r[k])}
                    aria-invalid={errs.includes('size') && !(r[k] >= 1) ? true : undefined}
                    onChange={(e) => patch(r.key, { [k]: numOr(e.target.value) })}
                  />
                ))}
              </div>
              {err('size') && <p className="-mt-1 text-label text-crit">{err('size')}</p>}
              <div className="grid grid-cols-2 gap-2">
                <NumberField
                  label={t('check.qty')}
                  inputMode="numeric"
                  value={show(r.quantity)}
                  error={err('quantity')}
                  onChange={(e) => patch(r.key, { quantity: numOr(e.target.value) })}
                />
                <NumberField
                  label={t('check.kg')}
                  unit="kg"
                  inputMode="decimal"
                  value={show(r.weightKg)}
                  error={err('weight')}
                  onChange={(e) => patch(r.key, { weightKg: numOr(e.target.value) })}
                />
              </div>
              <SelectField
                label={t('check.drop')}
                options={stopOptions}
                value={r.dropStopId}
                error={err('drop')}
                onChange={(e) => patch(r.key, { dropStopId: e.target.value })}
              />
              <div className="flex flex-wrap gap-2">
                <Toggle
                  on={r.fragile}
                  label={t('check.fragile')}
                  onChange={(v) => patch(r.key, { fragile: v })}
                />
                <Toggle
                  on={r.uprightOnly}
                  label={t('check.upright')}
                  onChange={(v) => patch(r.key, { uprightOnly: v })}
                />
                <Toggle
                  on={!r.stackable}
                  label={t('check.noStack')}
                  onChange={(v) => patch(r.key, { stackable: !v })}
                />
              </div>
              {integrity && (
                <IntegrityNotes
                  blocks={integrity.blocks}
                  flags={integrity.flags.filter(
                    (f) => f !== 'LOW_AI_CONFIDENCE' && (f !== 'VAGUE_LABEL' || r.label.trim() !== ''),
                  )}
                  historyKg={integrity.historyKg}
                />
              )}
              {warns.map((w) => (
                <p key={w} className="flex items-center gap-1.5 text-label text-warn">
                  <AlertTriangle size={16} aria-hidden />
                  {t(`check.warn.${w}`, { counts: r.countsPerView.join(' / ') })}
                </p>
              ))}
            </section>
          )
        })}
      </div>
    </Sheet>
  )
}

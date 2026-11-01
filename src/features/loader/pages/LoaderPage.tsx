import { Suspense, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { toast } from 'sonner'
import { AlertTriangle, ArrowLeft, Check, CheckCheck, CheckCircle2, ClipboardList, Hourglass, Info, Layers, LinkIcon, Send } from 'lucide-react'
import { LanguageButton, Logo, MainButton, PlainButton, Sheet, Skeleton, StopChip, stopColor, ThemeButton } from '@/components/common'
import { Slot } from '@/app/slots'
import { TruckScene } from '@/features/load-planner'
import { useLowData } from '@/lib/lowData'
import { LANG_KEY } from '@/i18n/setup'
import { applyLang, useLang } from '@/lib/i18n'
import { toAppError } from '@/lib/errors'
import { formatCargoSize, formatWeight } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { LoaderJobOk, Placement } from '@/types/domain'
import { useLoaderJob, useUpdateStep, useUpdateSteps } from '../hooks'
import { firstOpenStep, layerBand, pendingOnLayer, positionWords, sameRun } from '../lib/position'
import { LayerView } from '../components/LayerView'
import { LayerList } from '../components/LayerList'
import { ItemSheet, type ItemStatus } from '../components/ItemSheet'

const REASONS = ['missing', 'damaged', 'size', 'other'] as const

/** Loader page language: saved on this phone, Hindi the first time (Engineering Reference 10). */
function useLoaderLanguage() {
  useEffect(() => {
    try {
      if (!localStorage.getItem(LANG_KEY)) applyLang('hi', false)
    } catch {
      applyLang('hi', false)
    }
  }, [])
}

function Frame({ children, job }: { children: React.ReactNode; job?: LoaderJobOk }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-[480px] items-center justify-between gap-3 px-4 py-3">
          {job ? (
            <div className="min-w-0">
              <div className="truncate text-[19px] leading-6 font-semibold">{job.truck.regNo}</div>
              <div className="text-label text-ink-2">{job.trip.code}</div>
            </div>
          ) : (
            <Logo />
          )}
          <div className="flex shrink-0 items-center gap-2">
            <ThemeButton />
            <LanguageButton />
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-[480px] flex-col gap-4 px-4 pt-4 pb-10">{children}</main>
    </div>
  )
}

function Message({ icon: Icon, title, text, tone = 'default' }: { icon: typeof Check; title: string; text?: string; tone?: 'default' | 'ok' | 'crit' }) {
  return (
    <div className="mt-10 flex flex-col items-center gap-4 text-center">
      <span
        className={cn(
          'flex size-20 items-center justify-center rounded-full',
          tone === 'ok' ? 'bg-ok/15 text-ok' : tone === 'crit' ? 'bg-crit/15 text-crit' : 'bg-surface-2 text-ink-2',
        )}
      >
        <Icon size={40} aria-hidden />
      </span>
      <h1 className="text-[26px] leading-8 font-semibold">{title}</h1>
      {text && <p className="text-[19px] leading-7 text-ink-2">{text}</p>}
    </div>
  )
}

export default function LoaderPage() {
  const { token = '' } = useParams()
  useLoaderLanguage()
  const { t, td } = useLang('loader')
  const job = useLoaderJob(token)
  const update = useUpdateStep(token)
  const bulk = useUpdateSteps(token)
  const [picked, setPicked] = useState<Placement | null>(null)
  const [problemStep, setProblemStep] = useState<number | null>(null)
  const [step, setStep] = useState<number | null>(null)
  const [view, setView] = useState<'layer' | '3d'>('layer')
  const [layer, setLayer] = useState<number | null>(null)
  const { lowData } = useLowData()
  const [problemOpen, setProblemOpen] = useState(false)
  const [reason, setReason] = useState<(typeof REASONS)[number]>('missing')
  const [note, setNote] = useState('')

  const data = job.data
  const plan = data?.plan ?? null
  const placements = useMemo(() => (plan?.placements ?? []).slice().sort((a, b) => a.step - b.step), [plan])
  const total = placements.length
  const band = useMemo(() => layerBand(placements), [placements])
  const progress = useMemo(() => data?.progress ?? [], [data])
  const doneCount = progress.filter((p) => p.status === 'done').length
  const states = useMemo(() => {
    const m = new Map<string, 'done' | 'waiting' | 'issue' | 'planned'>()
    for (const p of progress) m.set(p.key, p.status === 'done' ? 'done' : p.status === 'issue' ? 'issue' : 'waiting')
    return m
  }, [progress])

  // start at the first open step; keep the loader's place across polls and re-plans
  useEffect(() => {
    if (plan && step === null) setStep(firstOpenStep(progress))
  }, [plan, progress, step])

  if (job.isLoading) {
    return (
      <Frame>
        <Skeleton className="h-10" />
        <Skeleton className="h-72" />
        <Skeleton className="h-14" />
      </Frame>
    )
  }
  if (job.error) {
    const invalid = toAppError(job.error).code === 'LINK_INVALID'
    return (
      <Frame>
        {invalid ? (
          <Message icon={LinkIcon} tone="crit" title={t('page.endedTitle')} text={t('page.endedText')} />
        ) : (
          <Message icon={AlertTriangle} tone="crit" title={t(`common:errors.${toAppError(job.error).code}`)} />
        )}
      </Frame>
    )
  }
  if (!data) return null
  if (!plan || total === 0)
    return (
      <Frame job={data}>
        <Message icon={Hourglass} title={t('page.planning')} text={t('page.planningText')} />
      </Frame>
    )

  const allDone = doneCount === total
  const current = Math.min(Math.max(step ?? 1, 1), total)
  const p: Placement | undefined = placements.find((x) => x.step === current)
  const status = progress.find((x) => x.step === current)?.status
  const drops = data.stops.filter((s) => s.type !== 'origin').sort((a, b) => a.seq - b.seq)
  const stop = p ? drops[p.unloadOrder - 1] : undefined
  const words = p ? positionWords(p, data.truck, placements) : null
  const container = { lengthCm: data.truck.lengthCm, widthCm: data.truck.widthCm, heightCm: data.truck.heightCm }

  // next box still to load after `after`, skipping the ones just marked (the poll has not caught up yet)
  const nextOpen = (after: number, skip: number[] = []) => {
    const open = progress
      .filter((x) => x.status === 'pending' && !skip.includes(x.step))
      .sort((a, b) => a.step - b.step)
    return (open.find((x) => x.step > after) ?? open[0])?.step ?? Math.min(after + 1, total)
  }
  const statusOf = (stepN: number): ItemStatus => {
    const st = progress.find((x) => x.step === stepN)?.status
    return st === 'done' ? 'done' : st === 'issue' ? 'issue' : 'pending'
  }

  const goTo = (n: number) => {
    setLayer(null) // show the layer of the next box
    setStep(n)
  }

  const failed = async (e: unknown) => {
    const code = toAppError(e).code
    if (code === 'PLAN_CHANGED') {
      toast(t('page.planChanged'))
      await job.refetch() // same step number on the new plan
    } else toast.error(t(`common:errors.${code}`))
  }

  const send = async (s: 'done' | 'issue', text = '', target = current) => {
    if (!p) return
    try {
      await update.mutateAsync({ planId: plan.id, step: target, status: s, note: text })
      if (s === 'issue') {
        toast.success(t('page.problemSent'))
        setProblemOpen(false)
        setNote('')
        setProblemStep(null)
      }
      if (target === current) goTo(nextOpen(current, [current]))
    } catch (e) {
      await failed(e)
    }
  }

  /** One tap for many boxes; a toast offers Undo in case it was tapped by mistake. */
  const markMany = async (steps: number[], s: 'done' | 'pending' = 'done') => {
    if (steps.length === 0) return
    try {
      await bulk.mutateAsync({ planId: plan.id, steps, status: s })
      if (s === 'done') {
        toast.success(t('page.markedN', { count: steps.length }), {
          action: { label: t('page.undo'), onClick: () => void markMany(steps, 'pending') },
        })
        if (steps.includes(current)) goTo(nextOpen(Math.max(...steps), steps))
      }
    } catch (e) {
      await failed(e)
    }
  }

  if (allDone)
    return (
      <Frame job={data}>
        <Message icon={CheckCircle2} tone="ok" title={t('page.finishedTitle')} text={t('page.finishedText', { total })} />
        <Slot name="loader.actions" props={{ token, job: data }} />
      </Frame>
    )

  const layerWord = words ? (words.layer <= 3 ? t(`page.layer.${words.layer}`) : t('page.layer.n', { n: words.layer })) : ''
  const run = p ? sameRun(placements, progress, current, band) : []
  const shownLayer = layer ?? words?.layer ?? 1
  const shownWord = shownLayer <= 3 ? t(`page.layer.${shownLayer}`) : t('page.layer.n', { n: shownLayer })
  const pendingHere = pendingOnLayer(placements, progress, shownLayer, band)
  const busy = update.isPending || bulk.isPending
  const stopNameOf = (q: Placement) => drops[q.unloadOrder - 1]?.name

  return (
    <Frame job={data}>
      <div className="sticky top-[73px] z-10 -mx-4 bg-canvas px-4 pb-2">
        <div className="flex items-baseline justify-between text-[17px] font-semibold">
          <span>{t('page.stepOf', { step: current, total })}</span>
          <span className="text-label text-ink-2">{t('page.loaded', { done: doneCount, total })}</span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={total}>
          <div className="h-full rounded-full bg-ok transition-[width] duration-200" style={{ width: `${(100 * doneCount) / total}%` }} />
        </div>
      </div>

      {p && (
        <section className="rounded-card border border-line bg-surface p-4" aria-live="polite">
          <div className="flex items-start justify-between gap-3">
            <button type="button" onClick={() => setPicked(p)} className="flex min-w-0 items-start gap-2 text-left">
              <h1 className="text-[26px] leading-8 font-semibold">
                {run.length > 1 ? `${run.length} × ${td(p.label)}` : td(p.label)}
              </h1>
              <Info size={22} className="mt-1.5 shrink-0 text-ink-3" aria-label={t('page.item.what')} />
            </button>
            {status === 'issue' && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-crit/15 px-2 py-1 text-label font-semibold text-crit">
                <AlertTriangle size={14} aria-hidden />
                {t('page.issueMark')}
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {stop && <StopChip seq={p.unloadOrder} name={stop.name} />}
            <span className="h-4 w-1.5 rounded-full" style={{ background: stopColor(p.unloadOrder) }} aria-hidden />
          </div>
          <p className="mt-2 text-[19px] leading-7 text-ink-2 tabular">
            {t('page.sizeWeight', { size: formatCargoSize(p.l, p.w, p.h), kg: formatWeight(p.weightKg) })}
          </p>
          {p.fragile && <p className="mt-1 text-[19px] leading-7 font-medium text-warn">{t('page.fragile')}</p>}
          {run.length > 1 && <p className="mt-1 text-[17px] leading-6 text-ink-2">{t('page.runHint', { n: run.length })}</p>}

          {words && (
            <div className="mt-4 rounded-tile bg-accent-soft p-3">
              <div className="text-label text-ink-2">{t('page.where')}</div>
              <div className="text-[22px] leading-8 font-semibold text-accent">
                {t(`page.along.${words.along}`)} · {t(`page.across.${words.across}`)} · {layerWord}
              </div>
            </div>
          )}

          <div className="mt-4">
            {!lowData && (
              <div className="mb-3 flex gap-1 rounded-control border border-line-strong bg-surface-2 p-1" role="group">
                {(['layer', '3d'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={view === v}
                    onClick={() => setView(v)}
                    className={cn('h-12 flex-1 rounded-[10px] text-[17px] font-semibold', view === v ? 'bg-surface-3 text-ink' : 'text-ink-2')}
                  >
                    {v === 'layer' ? t('page.byLayer') : t('page.in3d')}
                  </button>
                ))}
              </div>
            )}
            {view === '3d' && !lowData ? (
              <Suspense fallback={<Skeleton className="h-80" />}>
                <TruckScene container={container} placements={placements} highlightKey={p.key} states={states} visibleSteps={current} className="h-80" />
              </Suspense>
            ) : (
              <LayerView
                container={container}
                placements={placements}
                highlightKey={p.key}
                states={states}
                visibleSteps={current}
                layer={shownLayer}
                onLayer={setLayer}
                onPick={setPicked}
              />
            )}
          </div>
        </section>
      )}

      {run.length > 1 ? (
        <div className="flex flex-col gap-2">
          <MainButton icon={CheckCheck} size="lg" onClick={() => void markMany(run)} loading={busy} className="w-full">
            {t('page.loadedAll', { n: run.length })}
          </MainButton>
          <PlainButton icon={Check} onClick={() => send('done')} disabled={busy} className="h-14 text-[18px]">
            {t('page.onlyOne')}
          </PlainButton>
        </div>
      ) : (
        <MainButton icon={Check} size="lg" onClick={() => send('done')} loading={busy} className="w-full">
          {t('page.done')}
        </MainButton>
      )}
      {pendingHere.length > 1 && pendingHere.length !== run.length && (
        <PlainButton icon={Layers} onClick={() => void markMany(pendingHere)} disabled={busy} className="h-14 text-[18px]">
          {t('page.layerDone', { layer: shownWord, n: pendingHere.length })}
        </PlainButton>
      )}
      <div className="grid grid-cols-2 gap-2">
        <PlainButton
          icon={AlertTriangle}
          onClick={() => {
            setProblemStep(current)
            setProblemOpen(true)
          }}
          className="h-14 text-[18px]"
        >
          {t('page.problem')}
        </PlainButton>
        <PlainButton icon={ArrowLeft} onClick={() => goTo(Math.max(1, current - 1))} disabled={current <= 1} className="h-14 text-[18px]">
          {t('page.back')}
        </PlainButton>
      </div>

      <section className="rounded-card border border-line bg-surface p-4">
        <LayerList placements={placements} states={states} layer={shownLayer} band={band} currentStep={current} onPick={setPicked} />
      </section>

      <Slot name="loader.actions" props={{ token, job: data }} />

      <ItemSheet
        item={picked}
        all={placements}
        status={picked ? statusOf(picked.step) : 'pending'}
        container={container}
        stopName={picked ? stopNameOf(picked) : undefined}
        busy={busy}
        onClose={() => setPicked(null)}
        onMark={(q, st) => {
          setPicked(null)
          void (st === 'done' && q.step === current ? send('done') : markMany([q.step], st))
        }}
        onProblem={(q) => {
          setPicked(null)
          setProblemStep(q.step)
          setProblemOpen(true)
        }}
        onGoTo={(q) => {
          setPicked(null)
          goTo(q.step)
        }}
      />

      <Sheet
        open={problemOpen}
        onOpenChange={setProblemOpen}
        title={problemStep && problemStep !== current ? `${t('page.problemTitle')} · #${problemStep}` : t('page.problemTitle')}
        dirty={note.length > 0}
        footer={
          <MainButton icon={Send} size="lg" onClick={() => send('issue', `${t(`page.reasons.${reason}`)}${note ? ` — ${note}` : ''}`, problemStep ?? current)} loading={update.isPending} className="w-full">
            {t('page.sendProblem')}
          </MainButton>
        }
      >
        <div role="radiogroup" aria-label={t('page.problemTitle')} className="grid grid-cols-2 gap-2">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={reason === r}
              onClick={() => setReason(r)}
              className={cn(
                'min-h-16 rounded-tile border px-3 text-[18px] font-semibold',
                reason === r ? 'border-accent bg-accent-soft text-accent' : 'border-line-strong bg-surface-2',
              )}
            >
              {t(`page.reasons.${r}`)}
            </button>
          ))}
        </div>
        <label className="mt-4 flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-label font-medium text-ink-2">
            <ClipboardList size={16} aria-hidden />
            {t('page.note')}
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={200}
            className="rounded-control border border-line-strong bg-surface-2 p-3 text-[17px] focus:border-accent focus:outline-none"
          />
        </label>
      </Sheet>
    </Frame>
  )
}

// The Load plan workspace (Design System 7.7): summary on top, the truck (3D or drawings) with view buttons
// and "Play loading order", then the panel: Use this plan · Packages by stop · Didn't fit.
// Used by the trip step (slot trip.steps) and the full-screen page /trips/:tripId/plan.
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Box, Boxes, CircleCheck, Eye, Info, Lock, Maximize2, PackagePlus, Pause, Play, Rotate3d, TriangleAlert, X } from 'lucide-react'
import { EmptyState, ErrorState, MainButton, PlainButton, Skeleton, StatusChip } from '@/components/common'
import { useLang } from '@/lib/i18n'
import { useLowData, useReducedMotion } from '@/lib/lowData'
import { toAppError } from '@/lib/errors'
import { cn } from '@/lib/cn'
import { usePlanForTrip, type PlanForTrip } from '../hooks/usePlanForTrip'
import { boxStates } from '../lib/plan'
import { hasWebGL } from '../lib/webgl'
import { usePlanPalette } from '../lib/theme'
import { SideView, TopView } from './drawings'
import { PlanSummary } from './PlanSummary'
import { PackagesByStop } from './PackagesByStop'
import { DidntFit } from './DidntFit'
import type { SceneView } from './TruckScene'

const TruckScene = lazy(() => import('./TruckScene'))

const PLAY_MS = 120

function ViewButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Box; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-12 shrink-0 items-center gap-2 rounded-control border px-3 text-button font-semibold transition-colors duration-200',
        active ? 'border-accent bg-accent-soft text-ink' : 'border-line-strong bg-surface-2 text-ink hover:bg-surface-3',
      )}
    >
      <Icon size={20} aria-hidden />
      {label}
    </button>
  )
}

function UsePlanCard({ plan }: { plan: PlanForTrip }) {
  const { t } = useLang('load-planner')
  const unplaced = plan.result?.unplaced.length ?? 0
  const onUse = async () => {
    try {
      await plan.activate()
      toast.success(t('use.done'))
    } catch (err) {
      toast.error(t(`common:errors.${toAppError(err).code}`))
    }
  }
  if (!plan.canActivate)
    return (
      <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
        {plan.isActive && plan.activePlan && (
          <StatusChip tone="ok">{t('use.inUse', { version: plan.activePlan.version })}</StatusChip>
        )}
        <p className="flex items-start gap-2 text-ink-2">
          <Lock size={20} className="mt-0.5 shrink-0" aria-hidden />
          {t('use.locked')}
        </p>
      </div>
    )
  if (plan.isActive && plan.activePlan)
    return (
      <div className="flex items-center gap-3 rounded-card border border-ok/30 bg-ok/[0.06] p-4">
        <CircleCheck size={24} className="shrink-0 text-ok" aria-hidden />
        <span className="font-semibold">{t('use.inUse', { version: plan.activePlan.version })}</span>
      </div>
    )
  return (
    <div className="flex flex-col gap-3 rounded-card border border-accent/25 bg-accent-soft p-4">
      {plan.isOutdated && plan.activePlan && (
        <p className="flex items-start gap-2">
          <TriangleAlert size={20} className="mt-0.5 shrink-0 text-warn" aria-hidden />
          {t('use.outdated', { version: plan.activePlan.version })}
        </p>
      )}
      {unplaced > 0 && (
        <p className="flex items-start gap-2 text-ink-2">
          <Info size={20} className="mt-0.5 shrink-0" aria-hidden />
          {t('use.unplaced', { count: unplaced })}
        </p>
      )}
      <MainButton icon={CircleCheck} onClick={onUse} loading={plan.activating} className="w-full">
        {t('use.button')}
      </MainButton>
    </div>
  )
}

export function LoadPlanView({ tripId, variant = 'step' }: { tripId: string; variant?: 'step' | 'page' }) {
  const { t, td } = useLang('load-planner')
  const plan = usePlanForTrip(tripId)
  const palette = usePlanPalette()
  const { lowData } = useLowData()
  const reduced = useReducedMotion()
  const webgl = useMemo(() => hasWebGL(), [])
  const can3d = webgl && !lowData
  const [chosenView, setView] = useState<SceneView>('3d')
  const view: SceneView = !can3d && chosenView === '3d' ? 'top' : chosenView
  const [selected, setSelected] = useState<string | null>(null)
  const [visibleSteps, setVisibleSteps] = useState<number | undefined>(undefined)
  const [playing, setPlaying] = useState(false)

  const result = plan.result
  const total = result?.placements.length ?? 0

  // a new plan (cargo changed) resets the player and the selection
  const hash = result?.inputHash
  const [seenHash, setSeenHash] = useState(hash)
  if (seenHash !== hash) {
    setSeenHash(hash)
    setSelected(null)
    setVisibleSteps(undefined)
    setPlaying(false)
  }

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setVisibleSteps((s) => Math.min(total, (s ?? 0) + 1)), PLAY_MS)
    return () => clearInterval(id)
  }, [playing, total])
  // the last box is in → back to the normal view
  if (playing && visibleSteps !== undefined && visibleSteps >= total) {
    setPlaying(false)
    setVisibleSteps(undefined)
  }

  const states = useMemo(() => (plan.isActive ? boxStates(plan.progress) : undefined), [plan.isActive, plan.progress])
  const progressCounts = useMemo(() => {
    if (!states || states.size === 0) return null
    let done = 0
    let issues = 0
    for (const s of states.values()) {
      if (s === 'done') done++
      if (s === 'issue') issues++
    }
    return { done, issues }
  }, [states])

  if (plan.status === 'loading' || plan.status === 'packing')
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-32" />
        <Skeleton className="h-[320px] sm:h-[420px]" />
        {plan.status === 'packing' && <p className="text-center text-ink-2">{t('use.packing')}</p>}
      </div>
    )
  if (plan.status === 'error') return <ErrorState error={plan.error} onRetry={plan.retry} />
  if (plan.status === 'noCargo' || !result || !plan.container)
    return (
      <EmptyState
        icon={PackagePlus}
        text={t('empty.noCargo')}
        action={
          variant === 'page' ? (
            <Link
              to={`/trips/${tripId}?step=cargo`}
              className="inline-flex h-12 items-center gap-2 rounded-control border border-line-strong bg-surface-2 px-4 text-button font-semibold hover:bg-surface-3"
            >
              <PackagePlus size={20} aria-hidden />
              {t('empty.openCargo')}
            </Link>
          ) : undefined
        }
      />
    )

  const container = plan.container
  const selectedPlacement = result.placements.find((p) => p.key === selected)
  const onPlay = () => {
    if (playing) return setPlaying(false)
    setSelected(null)
    if (reduced) {
      // no animation: step through with the slider instead
      setVisibleSteps((s) => s ?? 1)
      return
    }
    setVisibleSteps((s) => (s === undefined || s >= total ? 0 : s))
    setPlaying(true)
  }
  const show = (key: string) => {
    setSelected(key)
    setVisibleSteps(undefined)
    setPlaying(false)
  }

  const drawingProps = {
    container,
    placements: result.placements,
    highlightKey: selected,
    states,
    visibleSteps,
    onSelect: show,
  }

  return (
    <div className="flex flex-col gap-4">
      {variant === 'step' && (
        <div className="flex justify-end">
          <Link
            to={`/trips/${tripId}/plan`}
            className="inline-flex h-12 items-center gap-2 rounded-control border border-line-strong bg-surface-2 px-4 text-button font-semibold hover:bg-surface-3"
          >
            <Maximize2 size={20} aria-hidden />
            {t('fullScreen')}
          </Link>
        </div>
      )}

      <PlanSummary container={container} result={result} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-label={t('view.label')} className="flex min-w-0 flex-col gap-3">
          <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {can3d && <ViewButton active={view === '3d'} icon={Rotate3d} label={t('view.3d')} onClick={() => setView('3d')} />}
            <ViewButton active={view === 'top'} icon={Boxes} label={t('view.top')} onClick={() => setView('top')} />
            <ViewButton active={view === 'side'} icon={Box} label={t('view.side')} onClick={() => setView('side')} />
            <PlainButton icon={playing ? Pause : Play} onClick={onPlay} className="shrink-0">
              {playing ? t('view.pause') : t('view.play')}
            </PlainButton>
          </div>

          {!can3d && (
            <p className="flex items-center gap-2 text-label text-ink-2">
              <Info size={16} aria-hidden />
              {lowData ? t('view.lowData') : t('view.noWebgl')}
            </p>
          )}

          <div className="relative overflow-hidden rounded-card border border-line" style={{ background: palette.canvas }}>
            {can3d ? (
              <Suspense
                fallback={
                  <div className="flex h-[320px] items-center justify-center text-ink-2 sm:h-[420px] lg:h-[520px]">{t('view.loading3d')}</div>
                }
              >
                <TruckScene {...drawingProps} view={view} className="h-[320px] w-full sm:h-[420px] lg:h-[520px]" />
              </Suspense>
            ) : view === 'side' ? (
              <SideView {...drawingProps} className="p-3 sm:p-4" />
            ) : (
              <TopView {...drawingProps} className="p-3 sm:p-4" />
            )}
            {can3d && (
              <>
                <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-canvas/80 px-3 py-1 text-label text-ink-2">
                  {t('common:words.cabSide')}
                </span>
                <span className="pointer-events-none absolute right-3 bottom-3 rounded-full bg-canvas/80 px-3 py-1 text-label text-ink-2">
                  {t('common:words.doorSide')}
                </span>
              </>
            )}
          </div>

          {visibleSteps !== undefined && (
            <div className="flex flex-wrap items-center gap-3 rounded-tile border border-line bg-surface-2 p-3">
              <label className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="text-label text-ink-2 tabular">{t('view.stepOf', { step: visibleSteps, total })}</span>
                <input
                  type="range"
                  min={0}
                  max={total}
                  value={visibleSteps}
                  aria-label={t('view.stepSlider')}
                  onChange={(e) => {
                    setPlaying(false)
                    setVisibleSteps(Number(e.target.value))
                  }}
                  className="h-8 w-full accent-accent"
                />
              </label>
              <PlainButton
                icon={Eye}
                onClick={() => {
                  setPlaying(false)
                  setVisibleSteps(undefined)
                }}
              >
                {t('view.showAll')}
              </PlainButton>
            </div>
          )}

          {selectedPlacement && (
            <div className="flex items-center justify-between gap-3 rounded-tile border border-accent/40 bg-surface-2 p-3">
              <span className="min-w-0 font-medium">{t('view.selected', { step: selectedPlacement.step, label: td(selectedPlacement.label) })}</span>
              <PlainButton icon={X} onClick={() => setSelected(null)} className="shrink-0">
                {t('view.clear')}
              </PlainButton>
            </div>
          )}

          {progressCounts && (
            <p className="flex flex-wrap gap-x-3 text-ink-2 tabular">
              <span>{t('progress.loaded', { done: progressCounts.done, total })}</span>
              {progressCounts.issues > 0 && <span className="text-crit">{t('progress.problems', { count: progressCounts.issues })}</span>}
            </p>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-4">
          <UsePlanCard plan={plan} />
          <PackagesByStop result={result} stops={plan.stops} cargo={plan.cargo} selectedKey={selected} onShow={show} />
          <DidntFit result={result} cargo={plan.cargo} />
        </aside>
      </div>
    </div>
  )
}

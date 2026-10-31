import type { ReactNode } from 'react'
import { Bot, FlaskConical, Globe, Radio, Ruler, UserRound, type LucideIcon } from 'lucide-react'
import { useLang } from '@/lib/i18n'
import { cn } from '@/lib/cn'

export type Tone = 'ok' | 'warn' | 'crit' | 'info' | 'neutral' | 'accent' | 'violet'

const dot: Record<Tone, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  crit: 'bg-crit',
  info: 'bg-info',
  neutral: 'bg-ink-3',
  accent: 'bg-accent',
  violet: 'bg-violet',
}

/** Status with word + colour dot (never colour alone). */
export function StatusChip({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface-3 px-2.5 text-label font-medium text-ink',
        className,
      )}
    >
      <span className={cn('size-2 rounded-full', dot[tone])} aria-hidden />
      {children}
    </span>
  )
}

export const TRUCK_STATUS_TONE: Record<string, Tone> = { active: 'ok', idle: 'info', maintenance: 'warn', offline: 'neutral' }
export const TRIP_STATUS_TONE: Record<string, Tone> = {
  planned: 'info',
  loading: 'warn',
  in_transit: 'accent',
  completed: 'ok',
  cancelled: 'neutral',
}

export function TruckStatusChip({ status }: { status: string }) {
  const { t } = useLang()
  return <StatusChip tone={TRUCK_STATUS_TONE[status] ?? 'neutral'}>{t(`truckStatus.${status}`)}</StatusChip>
}

export function TripStatusChip({ status }: { status: string }) {
  const { t } = useLang()
  return <StatusChip tone={TRIP_STATUS_TONE[status] ?? 'neutral'}>{t(`tripStatus.${status}`)}</StatusChip>
}

const STOP_COLORS = ['#e3f58c', '#22d3ee', '#f5a524', '#a78bfa', '#fb7185', '#34d399', '#60a5fa', '#f472b6']

/** Colour of drop stop n (1-based); origin (0) is neutral. */
export function stopColor(seq: number): string {
  if (seq <= 0) return '#a1a1a8'
  return STOP_COLORS[(seq - 1) % STOP_COLORS.length]
}

/** Number in the stop colour + name. Names go through td(). */
export function StopChip({ seq, name, className }: { seq: number; name: string; className?: string }) {
  const { td } = useLang()
  return (
    <span className={cn('inline-flex h-8 min-w-0 items-center gap-2 rounded-full bg-surface-3 pr-3 pl-1 text-label font-medium', className)}>
      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-accent-ink"
        style={{ background: stopColor(seq) }}
      >
        {seq}
      </span>
      <span className="truncate">{td(name)}</span>
    </span>
  )
}

export type BadgeKind = 'sample' | 'simulated' | 'ai' | 'estimated' | 'approximate' | 'public' | 'loader' | 'demo'

const badgeIcon: Record<BadgeKind, LucideIcon> = {
  sample: FlaskConical,
  demo: FlaskConical,
  simulated: Radio,
  ai: Bot,
  estimated: Ruler,
  approximate: Ruler,
  public: Globe,
  loader: UserRound,
}

const badgeTone: Record<BadgeKind, string> = {
  sample: 'border-ink-3/40 text-ink-2',
  demo: 'border-ink-3/40 text-ink-2',
  simulated: 'border-info/40 text-info',
  ai: 'border-violet/50 text-[#a99ff7]',
  estimated: 'border-warn/40 text-warn',
  approximate: 'border-warn/40 text-warn',
  public: 'border-ok/40 text-ok',
  loader: 'border-info/40 text-info',
}

/** Honesty badges: Sample / Simulated / AI / Estimated / Approximate / Public / Added by loader. */
export function Badge({ kind, className }: { kind: BadgeKind; className?: string }) {
  const { t } = useLang()
  const Icon = badgeIcon[kind]
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-[12px] font-semibold',
        badgeTone[kind],
        className,
      )}
    >
      <Icon size={13} aria-hidden />
      {t(`badges.${kind}`)}
    </span>
  )
}

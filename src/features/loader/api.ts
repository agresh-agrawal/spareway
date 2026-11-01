import { getSupabase } from '@/lib/supabase'
import { AppError, throwIfDataError, toAppError } from '@/lib/errors'
import { fixtureDelay, fixtureStore, FIXTURE_COMPANY_ID, isFixtureMode } from '@/lib/fixtures'
import type { LoaderJob, LoaderJobOk, LoaderStepStatus, PackMetrics, Placement } from '@/types/domain'
import type { Tables } from '@/types/database'

export type Trip = Tables<'trips'>
export type Alert = Tables<'alerts'>

// ---------------- owner side (signed in) ----------------

export interface LinkState {
  token: string | null
  expiresAt: string | null
  enabled: boolean
}

export async function getLinkState(tripId: string): Promise<LinkState> {
  if (isFixtureMode()) {
    const t = fixtureStore().trips.find((x) => x.id === tripId)
    if (!t) throw new AppError('TRIP_NOT_FOUND')
    return fixtureDelay({ token: t.loader_token, expiresAt: t.loader_token_expires_at, enabled: t.loader_link_enabled })
  }
  const { data, error } = await getSupabase()
    .from('trips')
    .select('loader_token, loader_token_expires_at, loader_link_enabled')
    .eq('id', tripId)
    .maybeSingle()
  if (error) throw toAppError(error)
  if (!data) throw new AppError('TRIP_NOT_FOUND')
  return { token: data.loader_token, expiresAt: data.loader_token_expires_at, enabled: data.loader_link_enabled }
}

/** New 48 h link (replaces the old one). */
export async function createLoaderLink(tripId: string): Promise<{ token: string; expiresAt: string }> {
  if (isFixtureMode()) {
    const t = fixtureStore().trips.find((x) => x.id === tripId)!
    const token = crypto.randomUUID().replace(/-/g, '').slice(0, 36)
    const expiresAt = new Date(Date.now() + 48 * 3_600_000).toISOString()
    Object.assign(t, { loader_token: token, loader_token_expires_at: expiresAt, loader_link_enabled: true })
    return fixtureDelay({ token, expiresAt })
  }
  const { data, error } = await getSupabase().rpc('create_loader_link', { p_trip_id: tripId })
  if (error) throw toAppError(error)
  const d = data as { token: string; expires_at: string }
  return { token: d.token, expiresAt: d.expires_at }
}

export async function disableLoaderLink(tripId: string): Promise<void> {
  if (isFixtureMode()) {
    const t = fixtureStore().trips.find((x) => x.id === tripId)
    if (t) t.loader_link_enabled = false
    return fixtureDelay(undefined)
  }
  const { error } = await getSupabase().rpc('disable_loader_link', { p_trip_id: tripId })
  if (error) throw toAppError(error)
}

export interface LoadingProgressSummary {
  total: number
  done: number
  issues: { step: number; note: string }[]
}

export async function getProgress(planId: string): Promise<LoadingProgressSummary> {
  const rows = isFixtureMode()
    ? fixtureStore().loading_progress.filter((p) => p.load_plan_id === planId)
    : await (async () => {
        const { data, error } = await getSupabase()
          .from('loading_progress')
          .select('step_index, status, note')
          .eq('load_plan_id', planId)
          .order('step_index')
        if (error) throw toAppError(error)
        return data
      })()
  const out = {
    total: rows.length,
    done: rows.filter((r) => r.status === 'done').length,
    issues: rows.filter((r) => r.status === 'issue').map((r) => ({ step: r.step_index, note: r.note })),
  }
  return isFixtureMode() ? fixtureDelay(out) : out
}

/** Open loader problems for the trip (kind loader_issue / loader_cargo). */
export async function getLoaderAlerts(tripId: string): Promise<Alert[]> {
  if (isFixtureMode())
    return fixtureDelay(fixtureStore().alerts.filter((a) => a.trip_id === tripId && !a.resolved && a.kind.startsWith('loader_')))
  const { data, error } = await getSupabase()
    .from('alerts')
    .select('*')
    .eq('trip_id', tripId)
    .eq('resolved', false)
    .in('kind', ['loader_issue', 'loader_cargo'])
    .order('created_at', { ascending: false })
  if (error) throw toAppError(error)
  return data
}

// ---------------- loader side (no login: loader_* functions only) ----------------

function fixtureJob(token: string): LoaderJob {
  const d = fixtureStore()
  const t = d.trips.find((x) => x.loader_token === token)
  const valid =
    t && t.loader_link_enabled && t.loader_token_expires_at && new Date(t.loader_token_expires_at) > new Date() && ['planned', 'loading'].includes(t.status)
  if (!t || !valid) return { error: 'LINK_INVALID' }
  const truck = d.trucks.find((x) => x.id === t.truck_id)!
  const plan = d.load_plans.filter((p) => p.trip_id === t.id && p.status === 'active').sort((a, b) => b.version - a.version)[0]
  return {
    company: d.company.name,
    trip: { id: t.id, code: t.code, status: t.status, expiresAt: t.loader_token_expires_at! },
    truck: {
      regNo: truck.reg_no,
      model: truck.model,
      lengthCm: truck.internal_length_cm,
      widthCm: truck.internal_width_cm,
      heightCm: truck.internal_height_cm,
      payloadKg: truck.payload_kg,
    },
    stops: d.trip_stops
      .filter((s) => s.trip_id === t.id)
      .sort((a, b) => a.seq - b.seq)
      .map((s) => ({ id: s.id, seq: s.seq, type: s.stop_type as 'origin' | 'drop' | 'pickup', name: s.name })),
    plan: plan ? { id: plan.id, version: plan.version, placements: plan.placements as unknown as Placement[], metrics: plan.metrics as unknown as PackMetrics } : null,
    progress: plan
      ? d.loading_progress
          .filter((p) => p.load_plan_id === plan.id)
          .sort((a, b) => a.step_index - b.step_index)
          .map((p) => ({ step: p.step_index, key: p.placement_key, status: p.status as LoaderStepStatus, note: p.note }))
      : [],
  }
}

/** Everything the loader page needs (loader_get_job). Invalid link → AppError('LINK_INVALID'). */
export async function getJob(token: string): Promise<LoaderJobOk> {
  const job = isFixtureMode()
    ? await fixtureDelay(fixtureJob(token))
    : await (async () => {
        const { data, error } = await getSupabase().rpc('loader_get_job', { p_token: token })
        if (error) throw toAppError(error)
        return data as unknown as LoaderJob
      })()
  if ('error' in job) throw new AppError('LINK_INVALID')
  return job
}

/** Step done / problem (loader_update_step). Errors LINK_INVALID | BAD_STATUS | PLAN_CHANGED. */
export async function updateStep(token: string, planId: string, step: number, status: LoaderStepStatus, note = ''): Promise<void> {
  if (isFixtureMode()) {
    const d = fixtureStore()
    const t = d.trips.find((x) => x.loader_token === token)
    if (!t) throw new AppError('LINK_INVALID')
    const active = d.load_plans.find((p) => p.id === planId && p.status === 'active' && p.trip_id === t.id)
    if (!active) throw new AppError('PLAN_CHANGED')
    const row = d.loading_progress.find((p) => p.load_plan_id === planId && p.step_index === step)
    if (row) Object.assign(row, { status, note, updated_at: new Date().toISOString() })
    if (t.status === 'planned') t.status = 'loading'
    if (status === 'issue')
      d.alerts.push({
        id: crypto.randomUUID(),
        company_id: FIXTURE_COMPANY_ID,
        truck_id: null,
        trip_id: t.id,
        kind: 'loader_issue',
        severity: 'warning',
        title: 'Loader reported a problem',
        message: `${t.code} step ${step}: ${note}`,
        meta: { code: t.code, step, note },
        resolved: false,
        resolved_at: null,
        is_sample: false,
        created_at: new Date().toISOString(),
      })
    return fixtureDelay(undefined)
  }
  const { data, error } = await getSupabase().rpc('loader_update_step', {
    p_token: token,
    p_plan_id: planId,
    p_step: step,
    p_status: status,
    p_note: note,
  })
  if (error) throw toAppError(error)
  throwIfDataError(data)
}

/** Several steps done (or back to pending) in one tap (loader_update_steps). Errors LINK_INVALID | BAD_STATUS | PLAN_CHANGED. */
export async function updateSteps(token: string, planId: string, steps: number[], status: 'done' | 'pending'): Promise<void> {
  if (steps.length === 0) return
  if (isFixtureMode()) {
    const d = fixtureStore()
    const t = d.trips.find((x) => x.loader_token === token)
    if (!t) throw new AppError('LINK_INVALID')
    if (!d.load_plans.some((p) => p.id === planId && p.status === 'active' && p.trip_id === t.id)) throw new AppError('PLAN_CHANGED')
    const now = new Date().toISOString()
    for (const row of d.loading_progress)
      if (row.load_plan_id === planId && steps.includes(row.step_index)) Object.assign(row, { status, note: '', updated_at: now })
    if (t.status === 'planned') t.status = 'loading'
    return fixtureDelay(undefined)
  }
  const { data, error } = await getSupabase().rpc('loader_update_steps', {
    p_token: token,
    p_plan_id: planId,
    p_steps: steps,
    p_status: status,
  })
  if (error) throw toAppError(error)
  throwIfDataError(data)
}

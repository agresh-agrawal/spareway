// App-level contracts (Engineering Reference section 1). Names are final — change only via a
// CONTRACT CHANGE REQUEST. DB rows use the generated types in ./database.ts.
import type { ComponentType, LazyExoticComponent, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { Session, User } from '@supabase/supabase-js'
import type { Tables } from './database'

// ---------- 1.1 / 1.2 Feature modules and slots ----------

export type SlotName =
  | 'home.actions'
  | 'home.widgets'
  | 'settings.sections'
  | 'truck.tabs'
  | 'trip.steps'
  | 'trip.actions'
  | 'cargo.addMethods'
  | 'loader.actions'

export interface SlotProps {
  'home.actions': Record<string, never>
  'home.widgets': Record<string, never>
  'settings.sections': Record<string, never>
  'truck.tabs': { truckId: string }
  'trip.steps': { tripId: string }
  'trip.actions': { tripId: string }
  'cargo.addMethods': { tripId: string; onAdded?: () => void }
  'loader.actions': { token: string; job: LoaderJobOk }
}

export interface SlotEntry<P = Record<string, unknown>> {
  id: string
  order: number
  component: ComponentType<P>
  labelKey?: string
  icon?: LucideIcon
  when?: (props: P) => boolean
  /** trip.steps only: shows ✓ on the step tab */
  done?: (props: P) => boolean
  count?: (props: P) => number | undefined
}

export type SlotEntries = { [K in SlotName]?: SlotEntry<SlotProps[K]>[] }

export interface NavItem {
  labelKey: string
  icon: LucideIcon
  path: string
  phone: 'tab' | 'more' | 'hidden'
}

type LazyPage = LazyExoticComponent<ComponentType> | ComponentType

export interface ModuleRoute {
  path: string
  element: LazyPage
  titleKey: string
}

export interface PublicRoute {
  path: string
  element: LazyPage
  guard: 'publicOnly' | 'none'
}

export interface FeatureModule {
  /** = folder name; also the i18n namespace */
  id: string
  /** menu order: Home 0, Trucks 10, Trips 20, Map 30, Loads 40, Earnings 50, Settings 99 */
  order: number
  nav?: NavItem
  routes?: ModuleRoute[]
  publicRoutes?: PublicRoute[]
  slots?: SlotEntries
  /** feature translations, registered under namespace = id */
  i18n?: { en: Record<string, unknown>; hi: Record<string, unknown> }
}

// ---------- 1.3 Errors, auth and language ----------

export type ErrorCode =
  | 'INVALID_LOGIN'
  | 'EMAIL_NOT_CONFIRMED'
  | 'EMAIL_TAKEN'
  | 'WEAK_PASSWORD'
  | 'RATE_LIMITED'
  | 'NETWORK'
  | 'NOT_SIGNED_IN'
  | 'LINK_INVALID'
  | 'PLAN_CHANGED'
  | 'BAD_DROP_STOP'
  | 'BAD_STATUS'
  | 'BAD_SOURCE'
  | 'BAD_ITEMS'
  | 'TRIP_NOT_FOUND'
  | 'PLAN_NOT_FOUND'
  | 'LISTING_NOT_OPEN'
  | 'LISTING_NOT_FOUND'
  | 'ALREADY_ACCEPTED'
  | 'EXTRA_LOAD_NOT_FOUND'
  | 'DROP_BEFORE_PICKUP'
  | 'ORS_ERROR'
  | 'ORS_QUOTA'
  | 'AI_TIMEOUT'
  | 'AI_PARSE'
  | 'TOO_LARGE'
  | 'AUTH_REQUIRED'
  | 'DUPLICATE'
  | 'UNKNOWN'

export type AuthStatus = 'loading' | 'signedOut' | 'preparing' | 'ready' | 'error'

export type Lang = 'en' | 'hi'

export interface UseLang {
  lang: Lang
  toggle: () => void
  set: (lang: Lang) => void
}

export type Profile = Tables<'profiles'>
export type Company = Tables<'companies'>
export type CompanySettings = Tables<'company_settings'>

export interface UseAuth {
  session: Session | null
  user: User | null
  profile: Profile | null
  company: Company | null
  settings: CompanySettings | null
  status: AuthStatus
  error: { code: ErrorCode; message: string } | null
  signInWithPassword: (email: string, password: string) => Promise<void>
  signUp: (input: { fullName: string; companyName: string; email: string; password: string }) => Promise<{
    needsConfirmation: boolean
  }>
  signInWithGoogle: (next?: string) => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  updatePassword: (pw: string) => Promise<void>
  resendConfirmation: (email: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

// ---------- 1.4 Packing ----------

export interface PackContainer {
  lengthCm: number
  widthCm: number
  heightCm: number
  payloadKg: number
}

export interface PackItem {
  /** `<cargoItemId>#<n>` */
  key: string
  cargoItemId: string
  label: string
  l: number
  w: number
  h: number
  weightKg: number
  unloadOrder: number
  loadOrder?: number
  fragile: boolean
  uprightOnly: boolean
  stackable: boolean
  maxTopLoadKg?: number
}

export interface Placement {
  key: string
  cargoItemId: string
  label: string
  x: number
  y: number
  z: number
  l: number
  w: number
  h: number
  /** 0–5 */
  orientation: number
  unloadOrder: number
  weightKg: number
  fragile: boolean
  step: number
  fixed?: boolean
}

export type UnplacedReason = 'TOO_LARGE' | 'OVER_PAYLOAD' | 'NO_SPACE' | 'NO_SUPPORT' | 'ORDER_CONFLICT'

export interface PackMetrics {
  volumeUsedPct: number
  weightUsedPct: number
  usedLengthCm: number
  freeVolumeM3: number
  remainingPayloadKg: number
  cogXPct: number
  cogYPct: number
  itemCount: number
  unplacedCount: number
}

export interface PackResult {
  engineVersion: string
  inputHash: string
  placements: Placement[]
  unplaced: { key: string; label: string; reason: UnplacedReason }[]
  metrics: PackMetrics
  warnings: { code: 'COG_LONGITUDINAL' | 'COG_LATERAL' | 'HEAVY_HIGH' | 'LOAD_GAP'; message: string }[]
}

export interface PackOptions {
  /** default 1.0 */
  supportRatio?: number
  /** default true */
  heavyBelow?: boolean
  /** default 0.5 cm */
  epsilon?: number
}

// ---------- 1.5 Loader job ----------

export type LoaderStepStatus = 'pending' | 'done' | 'skipped' | 'issue'

export interface LoaderJobOk {
  company: string
  trip: { id: string; code: string; status: string; expiresAt: string }
  truck: { regNo: string; model: string; lengthCm: number; widthCm: number; heightCm: number; payloadKg: number }
  stops: { id: string; seq: number; type: 'origin' | 'pickup' | 'drop'; name: string }[]
  plan: null | { id: string; version: number; placements: Placement[]; metrics: PackMetrics }
  progress: { step: number; key: string; status: LoaderStepStatus; note: string }[]
}

export type LoaderJob = LoaderJobOk | { error: 'LINK_INVALID' }

// ---------- 1.6 Routes and extra cargo ----------

export interface GeoLineString {
  type: 'LineString'
  coordinates: [number, number][]
}

export interface RouteVariant {
  variant: 'fastest' | 'shortest' | 'no_tolls'
  distanceKm: number
  durationMin: number
  geometry: GeoLineString
  restricted: boolean
  cached: boolean
}

export interface CostBreakdown {
  fuelInr: number
  tollsInr: number
  driverInr: number
  waitingInr: number
  totalInr: number
  score: number
  tollCount: number
  checkpointCount: number
}

export interface Halt {
  kind: 'break' | 'overnight' | 'no_entry_wait' | 'checkpoint'
  name: string
  lat: number
  lng: number
  atMin: number
  durationMin: number
  poiId?: string
}

export interface Schedule {
  halts: Halt[]
  stopEtas: { stopId: string; eta: string }[]
  warnings: { code: string; message: string }[]
}

export type FeasibilityReason =
  | 'OFF_CORRIDOR'
  | 'WRONG_DIRECTION'
  | 'TOO_LATE'
  | 'OVER_PAYLOAD'
  | 'NO_SPACE'
  | 'ORDER_CONFLICT'
  | 'LOW_MARGIN'

export interface Feasibility {
  ok: boolean
  reason?: FeasibilityReason
  detail: string
}

export interface ExtraCandidate {
  listingId: string
  code: string
  pickupKm: number
  dropKm: number
  detourKm: number
  detourMin: number
  cost: { detourInr: number; tollsInr: number; handlingInr: number; waitingInr: number; delayInr: number; totalInr: number }
  netBenefitInr: number
  minViableRateInr: number
  recommended: boolean
  approximate: boolean
  explanation: { en: string; hi: string }
  feasibility: Feasibility
}

// ---------- 1.7 Smart input ----------

export interface ParsedCargoItem {
  label: string
  lengthCm: number
  widthCm: number
  heightCm: number
  quantity: number
  weightKg?: number
  fragile: boolean
  uprightOnly: boolean
  stackable: boolean
  /** 0–1 */
  confidence: number
  notes: string
  source: 'camera' | 'voice'
}

export interface VoiceParseResult {
  items: ParsedCargoItem[]
  missing: ('length' | 'width' | 'height' | 'quantity' | 'weight')[]
  unsure: boolean
  transcript: string
}

/** one row for loader_add_cargo(p_items) */
export interface LoaderCargoRow {
  label: string
  lengthCm: number
  widthCm: number
  heightCm: number
  weightKg: number
  quantity: number
  dropStopId: string
  fragile: boolean
  uprightOnly: boolean
  stackable: boolean
  imagePath?: string
  confidence?: number
}

// ---------- shared helpers ----------

export interface WithChildren {
  children?: ReactNode
}

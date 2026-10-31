import { z } from 'zod'

const n = (min: number, max: number) =>
  z.coerce.number({ message: 'settings:errors.number' }).min(min, 'settings:errors.range').max(max, 'settings:errors.range')

/** Limits from Architecture F6. Messages are i18n keys. */
export const settingsSchema = z.object({
  fullName: z.string().trim().min(1, 'settings:errors.required').max(80),
  companyName: z.string().trim().min(1, 'settings:errors.required').max(80),
  city: z.string().trim().max(60),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[+\d\s-]*$/, 'settings:errors.phone'),
  diesel_price_inr_per_l: n(50, 200),
  driver_cost_inr_per_h: n(0, 2000),
  min_margin_inr: n(0, 100000),
  corridor_km: n(5, 100),
  handling_inr_per_kg: n(0, 50),
  waiting_cost_inr_per_h: n(0, 2000),
  delay_penalty_inr_per_min: n(0, 1000),
  value_of_time_inr_per_h: n(0, 2000),
  break_after_drive_h: n(0.5, 12),
  break_min: n(5, 240),
  max_drive_h_per_day: n(1, 16),
  overnight_rest_h: n(0.5, 12),
  avg_speed_kmph: n(10, 90),
  checkpoint_delay_min: n(0, 240),
  road_factor: n(1, 2),
  support_ratio: n(0.5, 1),
})

export type SettingsInput = z.input<typeof settingsSchema>
export type SettingsValues = z.output<typeof settingsSchema>

export const COST_FIELDS = ['diesel_price_inr_per_l', 'driver_cost_inr_per_h', 'min_margin_inr', 'corridor_km'] as const

export const MORE_FIELDS = [
  'handling_inr_per_kg',
  'waiting_cost_inr_per_h',
  'delay_penalty_inr_per_min',
  'value_of_time_inr_per_h',
  'break_after_drive_h',
  'break_min',
  'max_drive_h_per_day',
  'overnight_rest_h',
  'avg_speed_kmph',
  'checkpoint_delay_min',
  'road_factor',
  'support_ratio',
] as const

export type CostField = (typeof COST_FIELDS)[number] | (typeof MORE_FIELDS)[number]

/** Range shown in each field's help text */
export const FIELD_RANGE: Record<CostField, [number, number]> = {
  diesel_price_inr_per_l: [50, 200],
  driver_cost_inr_per_h: [0, 2000],
  min_margin_inr: [0, 100000],
  corridor_km: [5, 100],
  handling_inr_per_kg: [0, 50],
  waiting_cost_inr_per_h: [0, 2000],
  delay_penalty_inr_per_min: [0, 1000],
  value_of_time_inr_per_h: [0, 2000],
  break_after_drive_h: [0.5, 12],
  break_min: [5, 240],
  max_drive_h_per_day: [1, 16],
  overnight_rest_h: [0.5, 12],
  avg_speed_kmph: [10, 90],
  checkpoint_delay_min: [0, 240],
  road_factor: [1, 2],
  support_ratio: [0.5, 1],
}

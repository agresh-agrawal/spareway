import { settingsSchema } from './schemas'

const valid = {
  fullName: 'Agresh',
  companyName: 'Agresh Transport',
  city: 'Indore',
  phone: '+91 98270 00001',
  diesel_price_inr_per_l: 90,
  driver_cost_inr_per_h: 120,
  min_margin_inr: 500,
  corridor_km: 20,
  handling_inr_per_kg: 0.5,
  waiting_cost_inr_per_h: 300,
  delay_penalty_inr_per_min: 10,
  value_of_time_inr_per_h: 150,
  break_after_drive_h: 5,
  break_min: 30,
  max_drive_h_per_day: 10,
  overnight_rest_h: 8,
  avg_speed_kmph: 45,
  checkpoint_delay_min: 20,
  road_factor: 1.25,
  support_ratio: 1,
}

describe('settings schema limits', () => {
  it('accepts the database defaults', () => {
    expect(settingsSchema.safeParse(valid).success).toBe(true)
  })
  it.each([
    ['diesel_price_inr_per_l', 49],
    ['diesel_price_inr_per_l', 201],
    ['driver_cost_inr_per_h', 2001],
    ['driver_cost_inr_per_h', -1],
    ['corridor_km', 4],
    ['corridor_km', 101],
    ['support_ratio', 0.4],
    ['support_ratio', 1.1],
    ['break_after_drive_h', 0.4],
    ['break_after_drive_h', 13],
  ])('rejects %s = %s', (field, value) => {
    expect(settingsSchema.safeParse({ ...valid, [field]: value }).success).toBe(false)
  })
  it('coerces typed strings to numbers', () => {
    const r = settingsSchema.safeParse({ ...valid, diesel_price_inr_per_l: '95.5' })
    expect(r.success && r.data.diesel_price_inr_per_l).toBe(95.5)
  })
})

import { z } from 'zod'

const num = (min: number, max: number) =>
  z.number({ message: 'trucks:errors.number' }).min(min, 'trucks:errors.range').max(max, 'trucks:errors.range')

/** Truck form in stored units (cm, kg). Messages are i18n keys. */
export const truckSchema = z.object({
  reg_no: z
    .string()
    .trim()
    .min(4, 'trucks:errors.regNo')
    .max(20, 'trucks:errors.regNo')
    .transform((v) => v.toUpperCase().replace(/\s+/g, ' ')),
  model: z.string().trim().max(80),
  body_type: z.enum(['closed', 'container', 'open']),
  internal_length_cm: num(150, 1800),
  internal_width_cm: num(100, 300),
  internal_height_cm: num(100, 400),
  payload_kg: num(500, 60000),
  axles: num(2, 8).int('trucks:errors.number'),
  mileage_kmpl: num(1, 15),
  cost_per_km_inr: num(0, 200),
  driver_name: z.string().trim().max(60),
  driver_phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[+\d\s-]*$/, 'trucks:errors.phone'),
  status: z.enum(['active', 'idle', 'maintenance', 'offline']),
})

export type TruckInput = z.input<typeof truckSchema>
export type TruckValues = z.output<typeof truckSchema>

export const TRUCK_STATUSES = ['active', 'idle', 'maintenance', 'offline'] as const
export type TruckStatus = (typeof TRUCK_STATUSES)[number]

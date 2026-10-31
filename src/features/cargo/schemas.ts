import { z } from 'zod'

const size = z.number({ message: 'cargo:errors.number' }).min(1, 'cargo:errors.size').max(2000, 'cargo:errors.size')

/** Cargo line in stored units (cm, kg each). Messages are i18n keys. */
export const cargoSchema = z.object({
  label: z.string().trim().min(1, 'cargo:errors.label').max(80),
  client_name: z.string().trim().max(80),
  length_cm: size,
  width_cm: size,
  height_cm: size,
  weight_kg: z.number({ message: 'cargo:errors.number' }).min(0.1, 'cargo:errors.weight').max(30000, 'cargo:errors.weight'),
  quantity: z.number({ message: 'cargo:errors.number' }).int('cargo:errors.quantity').min(1, 'cargo:errors.quantity').max(5000, 'cargo:errors.quantity'),
  drop_stop_id: z.string().min(1, 'cargo:errors.drop'),
  pickup_stop_id: z.string().nullable(),
  fragile: z.boolean(),
  upright_only: z.boolean(),
  stackable: z.boolean(),
  priority: z.enum(['low', 'normal', 'high', 'critical']),
})

export type CargoInput = z.input<typeof cargoSchema>
export type CargoValues = z.output<typeof cargoSchema>

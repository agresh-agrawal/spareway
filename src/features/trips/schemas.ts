import { z } from 'zod'

export const wizardStopSchema = z.object({
  key: z.string(),
  name: z.string().trim().min(1),
  city: z.string(),
  lat: z.number(),
  lng: z.number(),
  stop_type: z.enum(['origin', 'drop', 'pickup']),
  /** optional "deliver by" (datetime-local value) */
  deliverBy: z.string().optional(),
})

/** The trip's driver: a name and an Indian mobile number (WhatsApp link, Call). */
export const driverSchema = z.object({
  driverName: z.string().trim().min(2, 'trips:errors.driverName').max(60, 'trips:errors.driverName'),
  driverPhone: z
    .string()
    .trim()
    .max(20, 'trips:errors.driverPhone')
    .regex(/^(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/, 'trips:errors.driverPhone'),
})

/** New trip wizard. Messages are i18n keys. */
export const wizardSchema = z
  .object({
    truckId: z.string().min(1, 'trips:errors.truck'),
    stops: z.array(wizardStopSchema),
    departure: z
      .string()
      .min(1, 'trips:errors.departure')
      .refine((v) => !Number.isNaN(new Date(v).getTime()), 'trips:errors.departure'),
    ...driverSchema.shape,
    freight: z.number({ message: 'trips:errors.freight' }).min(0, 'trips:errors.freight').max(10_000_000, 'trips:errors.freight'),
  })
  .superRefine((v, ctx) => {
    const origin = v.stops[0]
    if (!origin || origin.stop_type !== 'origin') ctx.addIssue({ code: 'custom', path: ['stops'], message: 'trips:errors.origin' })
    if (v.stops.filter((s) => s.stop_type !== 'origin').length < 1)
      ctx.addIssue({ code: 'custom', path: ['stops'], message: 'trips:errors.drops' })
  })

export type WizardValues = z.infer<typeof wizardSchema>
export type WizardStop = z.infer<typeof wizardStopSchema>

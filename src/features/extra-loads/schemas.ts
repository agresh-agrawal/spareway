import { z } from 'zod'

const num = (min: number, max: number, msg: string) =>
  z.coerce.number({ message: 'extra-loads:form.err.positive' }).min(min, msg).max(max, msg)

/** Post a load (F20). Messages are i18n keys. */
export const postLoadSchema = z
  .object({
    shipper_name: z.string().trim().min(1, 'extra-loads:form.err.required').max(80),
    shipper_phone: z.string().trim().max(20).regex(/^[+\d\s-]*$/, 'extra-loads:form.err.required'),
    goods_type: z.string().trim().min(1, 'extra-loads:form.err.required').max(60),
    from: z.string().min(1, 'extra-loads:form.err.required'),
    to: z.string().min(1, 'extra-loads:form.err.required'),
    length_cm: num(5, 1500, 'extra-loads:form.err.size'),
    width_cm: num(5, 1500, 'extra-loads:form.err.size'),
    height_cm: num(5, 1500, 'extra-loads:form.err.size'),
    weight_kg: num(0.1, 40000, 'extra-loads:form.err.positive'),
    quantity: z.coerce.number({ message: 'extra-loads:form.err.positive' }).int().min(1, 'extra-loads:form.err.positive').max(1000),
    fragile: z.boolean(),
    offered_rate_inr: num(1, 10_000_000, 'extra-loads:form.err.positive'),
    ready_from: z.string().min(1, 'extra-loads:form.err.required'),
  })
  .refine((v) => v.from !== v.to, { message: 'extra-loads:form.err.same', path: ['to'] })

export type PostLoadInput = z.input<typeof postLoadSchema>
export type PostLoadValues = z.output<typeof postLoadSchema>

const req = 'extra-loads:form.err.required'
const optionalInr = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.coerce.number({ message: 'extra-loads:form.err.positive' }).min(0, 'extra-loads:form.err.positive').max(10_000_000).optional(),
)

/** "Enter a load" (owner addition): one row per batch ("40 cartons" = 1 row × 40), several batches per load. */
export const typedLoadSchema = z
  .object({
    batches: z
      .array(
        z.object({
          label: z.string().trim().min(1, req).max(60),
          quantity: z.coerce.number({ message: 'extra-loads:form.err.positive' }).int().min(1, 'extra-loads:form.err.positive').max(1000),
          lengthCm: num(5, 1500, 'extra-loads:form.err.size'),
          widthCm: num(5, 1500, 'extra-loads:form.err.size'),
          heightCm: num(5, 1500, 'extra-loads:form.err.size'),
          weightKg: num(0.1, 40000, 'extra-loads:form.err.positive'),
          fragile: z.boolean(),
          nonStack: z.boolean(),
          orientation: z.enum(['any', 'upright']),
        }),
      )
      .min(1)
      .max(10),
    from: z.string().min(1, req),
    to: z.string().min(1, req),
    offered_rate_inr: num(0, 10_000_000, 'extra-loads:form.err.positive'),
    handling_inr: optionalInr,
    waiting_inr: optionalInr,
  })
  .refine((v) => v.from !== v.to, { message: 'extra-loads:form.err.same', path: ['to'] })

export type TypedLoadInput = z.input<typeof typedLoadSchema>
export type TypedLoadValues = z.output<typeof typedLoadSchema>

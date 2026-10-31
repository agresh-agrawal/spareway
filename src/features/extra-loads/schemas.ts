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

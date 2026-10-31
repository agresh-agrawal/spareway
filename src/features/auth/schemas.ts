import { z } from 'zod'

/** Password ≥ 8 with a letter and a number. Messages are i18n keys. */
export const password = z
  .string()
  .min(8, 'common:errors.WEAK_PASSWORD')
  .regex(/\p{L}/u, 'common:errors.WEAK_PASSWORD')
  .regex(/\d/, 'common:errors.WEAK_PASSWORD')

const email = z.string().trim().min(1, 'auth:required').email('auth:badEmail')

export const loginSchema = z.object({ email, password: z.string().min(1, 'auth:required') })

export const signupSchema = z
  .object({
    fullName: z.string().trim().min(1, 'auth:required').max(80),
    companyName: z.string().trim().max(80),
    email,
    password,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'auth:passwordsDiffer' })

export const forgotSchema = z.object({ email })

export const resetSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'auth:passwordsDiffer' })

export type LoginValues = z.infer<typeof loginSchema>
export type SignupValues = z.infer<typeof signupSchema>
export type ForgotValues = z.infer<typeof forgotSchema>
export type ResetValues = z.infer<typeof resetSchema>

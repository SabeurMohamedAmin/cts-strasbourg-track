/**
 * Zod schemas for admin authentication — shared by:
 *   - server handlers in server/api/admin/** (readValidatedBody),
 *   - the login / forgot-password / reset-password pages (client checks).
 */
import { z } from 'zod'

export const adminLoginSchema = z.object({
  username: z.string().min(1, 'Le nom d\u2019utilisateur est requis').max(80),
  password: z.string().min(1, 'Le mot de passe est requis').max(200),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Adresse e-mail invalide').max(200),
})

/** 12+ characters: long passphrases beat short \"complex\" passwords. */
export const newPasswordSchema = z
  .string()
  .min(12, '12 caract\u00e8res minimum')
  .max(200, '200 caract\u00e8res maximum')

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Jeton manquant').max(200),
  newPassword: newPasswordSchema,
})

export type AdminLoginInput = z.infer<typeof adminLoginSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

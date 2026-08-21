import type { H3Event } from 'h3'

/**
 * Thin mail wrapper around the Resend HTTP API (https://resend.com).
 *
 * Why plain $fetch and not the resend SDK: one POST request does not
 * justify a dependency, and the payload shape is trivial.
 *
 * Config (private runtimeConfig — see nuxt.config.ts / .env.example):
 *   NUXT_RESEND_API_KEY → resendApiKey
 *   NUXT_MAIL_FROM      → mailFrom (e.g. "Admin <admin@votredomaine.fr>")
 */

interface ResendPayload {
  from: string
  to: string[]
  subject: string
  text: string
  html: string
}

/** Sends the password-reset email (French, 24h validity note). */
export async function sendAdminPasswordResetEmail(
  event: H3Event,
  to: string,
  resetUrl: string,
): Promise<void> {
  const config = useRuntimeConfig(event)

  if (!config.resendApiKey || !config.mailFrom) {
    // Deployment error, not a user error — surface it in the server logs.
    throw createError({ statusCode: 500, statusMessage: 'Mailer is not configured' })
  }

  const subject = 'Réinitialisation du mot de passe admin'

  const text = [
    'Bonjour,',
    '',
    'Une réinitialisation du mot de passe administrateur a été demandée.',
    'Pour choisir un nouveau mot de passe, ouvrez ce lien :',
    '',
    resetUrl,
    '',
    'Ce lien est valable 24 heures et ne peut être utilisé qu’une seule fois.',
    'Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.',
  ].join('\n')

  const html = `
    <p>Bonjour,</p>
    <p>Une réinitialisation du mot de passe administrateur a été demandée.</p>
    <p><a href="${resetUrl}">Choisir un nouveau mot de passe</a></p>
    <p>Ce lien est valable <strong>24&nbsp;heures</strong> et ne peut être utilisé qu’une seule fois.</p>
    <p>Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.</p>
  `

  const payload: ResendPayload = {
    from: config.mailFrom,
    to: [to],
    subject,
    text,
    html,
  }

  await $fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.resendApiKey}` },
    body: payload,
  })
}

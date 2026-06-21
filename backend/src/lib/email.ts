import nodemailer from 'nodemailer'

export interface SendEmailInput {
  to: string
  subject: string
  text: string
  html?: string
}

let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST?.trim()
  if (!host) return null
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_PORT === '465',
      auth: process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    })
  }
  return transporter
}

export async function sendEmail(input: SendEmailInput): Promise<{ sent: boolean; provider: string }> {
  const from = process.env.EMAIL_FROM || 'Aura Syncro <noreply@aura-syncro.app>'
  const transport = getTransporter()

  if (!transport) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[email:dev]', input.to, input.subject)
      return { sent: true, provider: 'dev-log' }
    }
    console.warn('[email] SMTP non configurato')
    return { sent: false, provider: 'none' }
  }

  try {
    await transport.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html ?? input.text.replace(/\n/g, '<br>'),
    })
    return { sent: true, provider: 'smtp' }
  } catch (err) {
    console.error('[email]', err instanceof Error ? err.message : err)
    return { sent: false, provider: 'smtp-error' }
  }
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '')
}

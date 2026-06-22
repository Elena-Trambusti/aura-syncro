/**
 * Validazione variabili d'ambiente obbligatorie all'avvio.
 * Fallisce fast se la configurazione minima manca.
 */
export function validateEnv(): void {
  const required = ['DATABASE_URL', 'JWT_SECRET'] as const
  const missing = required.filter(key => !process.env[key]?.trim())

  if (missing.length > 0) {
    console.error(`❌ Variabili d'ambiente mancanti: ${missing.join(', ')}`)
    process.exit(1)
  }

  if (process.env.JWT_SECRET!.length < 16) {
    console.error('❌ JWT_SECRET troppo corto (minimo 16 caratteri)')
    process.exit(1)
  }

  if (isProduction()) {
    const requiredProd = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'ADMIN_API_KEY'] as const
    const missingProd = requiredProd.filter(key => !process.env[key]?.trim() || process.env[key]?.includes('inserisci'))
    if (missingProd.length > 0) {
      console.error(`❌ Variabili produzione mancanti: ${missingProd.join(', ')}`)
      process.exit(1)
    }
  }
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

export function isStripeWebhookSecretConfigured(): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  return !!secret && !secret.includes('inserisci')
}

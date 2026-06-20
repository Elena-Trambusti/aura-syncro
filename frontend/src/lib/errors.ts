import axios from 'axios'

export function formatApiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const apiError = err.response?.data as { error?: string } | undefined
    if (apiError?.error) return apiError.error

    if (err.response?.status === 503) {
      return 'Server API non configurato su Vercel (manca BACKEND_URL).'
    }
    if (err.response?.status === 502) {
      return 'Backend non raggiungibile. Verifica che DigitalOcean sia online.'
    }
    if (err.response?.status === 405) {
      return 'Richiesta API bloccata. Rideploya il frontend con la configurazione aggiornata.'
    }
    if (err.code === 'ERR_NETWORK' || !err.response) {
      return 'Impossibile contattare il server. Controlla connessione e configurazione BACKEND_URL.'
    }
  }

  return 'Credenziali non valide o errore di accesso.'
}

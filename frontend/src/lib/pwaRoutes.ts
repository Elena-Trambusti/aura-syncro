/** Percorsi PWA — allineati al router React (App.tsx) */
export const PWA_ROUTES = {
  /** APK/PWA: apri direttamente il login, non la landing marketing */
  start: '/login?pwa=1',
  orders: '/ordini',
} as const

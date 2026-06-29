/** Rotte pubbliche: un 401 non deve forzare il redirect al login. */
export function isPublicAppRoute(pathname: string): boolean {
  const path = pathname.replace(/\/$/, '') || '/'
  if (
    path === '/'
    || path === '/it'
    || path === '/es'
    || path === '/es-cn'
    || path === '/login'
    || path === '/register'
    || path === '/forgot-password'
    || path === '/reset-password'
    || path === '/prezzi'
    || path === '/privacy'
    || path === '/terms'
    || path === '/termini'
    || path === '/cookie'
    || path === '/dpa'
    || path === '/informativa-ospiti'
    || path === '/contatti'
  ) {
    return true
  }
  if (path.startsWith('/menu/')) return true
  if (path.startsWith('/prenota/')) return true
  if (path.startsWith('/payment/')) return true
  return false
}

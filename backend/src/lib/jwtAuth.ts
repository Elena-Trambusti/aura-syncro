import jwt from 'jsonwebtoken'

export interface AuthTokenPayload {
  userId: string
  restaurantId: string
  role: string
  tv?: number
  purpose?: string
}

/** Verifica JWT di sessione API — rifiuta token reset password e payload incompleti. */
export function verifySessionToken(token: string): AuthTokenPayload {
  const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthTokenPayload
  if (payload.purpose) {
    throw new Error('INVALID_TOKEN_PURPOSE')
  }
  if (!payload.userId || !payload.restaurantId) {
    throw new Error('INVALID_SESSION_PAYLOAD')
  }
  return payload
}

export function signAuthToken(user: {
  id: string
  restaurantId: string
  role: string
  tokenVersion?: number
}): string {
  return jwt.sign(
    {
      userId: user.id,
      restaurantId: user.restaurantId,
      role: user.role,
      tv: user.tokenVersion ?? 0,
    },
    process.env.JWT_SECRET!,
    { expiresIn: '24h' },
  )
}

/** @deprecated Usare verifySessionToken per le route autenticate. */
export function verifyAuthToken(token: string): AuthTokenPayload {
  return verifySessionToken(token)
}

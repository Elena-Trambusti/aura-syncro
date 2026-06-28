import jwt from 'jsonwebtoken'

export interface AuthTokenPayload {
  userId: string
  restaurantId: string
  role: string
  tv?: number
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

export function verifyAuthToken(token: string): AuthTokenPayload {
  return jwt.verify(token, process.env.JWT_SECRET!) as AuthTokenPayload
}

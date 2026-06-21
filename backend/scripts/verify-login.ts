import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ok = await prisma.user.findFirst({ where: { email: 'aurasyncro@gmail.com' } })
console.log('user found:', !!ok)
if (ok) {
  console.log('password ok:', await bcrypt.compare('AuraSyncro2026!', ok.password))
}
await prisma.$disconnect()

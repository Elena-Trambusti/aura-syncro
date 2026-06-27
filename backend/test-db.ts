import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  try {
    const candidates = await prisma.user.findMany({
      where: { email: 'aurasyncro@gmail.com', active: true },
      include: { restaurant: { include: { settings: true } } },
    });
    console.log('Candidates length:', candidates.length);
    if (candidates.length > 0) {
      console.log('User role:', candidates[0].role);
      console.log('Restaurant name:', candidates[0].restaurant.name);
    }
  } catch (err) {
    console.error('Prisma query failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const candidates = await prisma.user.findMany({
      where: { email: 'aurasyncro@gmail.com', active: true },
      include: { restaurant: { include: { settings: true } } },
    });
    console.log(candidates.length);
  } catch (err) {
    console.error("DB ERROR: ", err.message);
  } finally {
    await prisma.$disconnect();
  }
}
run();

import { prisma } from './src/lib/prisma'

async function run() {
  await prisma.restaurantSettings.updateMany({
    data: { stripeConnectAccountId: null }
  })
  console.log('Reset completato')
}
run()

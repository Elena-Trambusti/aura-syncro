import 'dotenv/config'
import { stripe } from './src/lib/stripe'
import { prisma } from './src/lib/prisma'

async function run() {
  const restaurant = await prisma.restaurant.findFirst({ include: { settings: true } })
  console.log('Testing full onboarding generation for:', restaurant?.name)
  
  try {
    let accountId = restaurant?.settings?.stripeConnectAccountId
    if (!accountId) {
      console.log('Creating new Express account...')
      const account = await stripe.accounts.create({
        type: 'express',
        country: restaurant?.settings?.countryCode || 'IT',
        email: restaurant?.email || undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'company',
        business_profile: {
          name: restaurant?.name || 'Aura Syncro',
          url: `https://aurasyncro.it/${restaurant?.slug || 'test'}`,
        }
      })
      accountId = account.id
      console.log('New account created:', accountId)
    }

    console.log('Creating account link for:', accountId)
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `http://localhost:5173/dashboard/pagamenti?connect=refresh`,
      return_url: `http://localhost:5173/dashboard/pagamenti?connect=success`,
      type: 'account_onboarding',
    })

    console.log('Success link:', accountLink.url)
  } catch (err: any) {
    console.error('Stripe error message:', err.message)
    console.error('Stripe error raw:', err.raw?.message)
  }
}
run()

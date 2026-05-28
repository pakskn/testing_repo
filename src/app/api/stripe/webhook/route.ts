import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature') || ''

  let event: any

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    )
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`)
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 })
  }

  const session = event.data.object

  // Handle Checkout Completion
  if (event.type === 'checkout.session.completed') {
    const userEmail = session.customer_email
    const subscriptionId = session.subscription

    if (userEmail && subscriptionId) {
      try {
        // Get subscription expiresAt details from Stripe
        const subscription = await stripe.subscriptions.retrieve(subscriptionId as string)
        const expiresAt = new Date(subscription.current_period_end * 1000)

        await prisma.user.update({
          where: { email: userEmail },
          data: {
            plan: 'premium',
            subscriptionStatus: 'active',
            planExpiresAt: expiresAt,
          },
        })
        console.log(`🎉 User ${userEmail} successfully upgraded to Premium!`)
      } catch (prismaErr) {
        console.error(`Error updating user plan on checkout completed:`, prismaErr)
      }
    }
  }

  // Handle Downgrade/Cancellation or Subscription Updates
  if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
    const subscription = session
    try {
      const customer = await stripe.customers.retrieve(subscription.customer as string)
      const email = (customer as any).email

      if (email) {
        const status = subscription.status // active, past_due, unpaid, canceled, trialing
        const expiresAt = new Date(subscription.current_period_end * 1000)

        await prisma.user.update({
          where: { email },
          data: {
            subscriptionStatus: status,
            plan: status === 'active' ? 'premium' : 'free',
            planExpiresAt: expiresAt,
          },
        })
        console.log(`🔄 User ${email} subscription updated to status: ${status}`)
      }
    } catch (err) {
      console.error(`Error updating user subscription on deleted/updated:`, err)
    }
  }

  return NextResponse.json({ received: true })
}

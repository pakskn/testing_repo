import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const priceId = process.env.STRIPE_PRICE_ID
    if (!priceId) {
      return new NextResponse('Stripe Price ID missing in configuration', { status: 500 })
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/channels/long-form?upgrade=success`,
      cancel_url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/channels/long-form?upgrade=cancel`,
      customer_email: session.user.email,
      metadata: {
        userId: session.user.id,
      },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error: any) {
    console.error('Stripe checkout error:', error)
    return new NextResponse(error.message || 'Internal Server Error', { status: 500 })
  }
}

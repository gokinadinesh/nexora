import Stripe from 'stripe';
import { logger } from '../utils/logger';
import { getDatabasePool } from '../config/db';


const stripeSecret = process.env.STRIPE_SECRET_KEY || 'sk_test_mock';
export const stripe = new Stripe(stripeSecret, {
  apiVersion: '2026-08-26.dahlia',
});

export class BillingService {
  async createCheckoutSession(userId: string, email: string): Promise<string | null> {
    try {
      if (stripeSecret === 'sk_test_mock') {
        logger.warn('Using mock Stripe secret, returning mock checkout URL');
        return 'https://mock.stripe.com/checkout/test';
      }

      // Pro Operator price tier
      const priceId = process.env.STRIPE_PRO_PRICE_ID || 'price_1MockProId';

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/billing/cancel`,
        customer_email: email,
        metadata: {
          userId,
        },
      });

      return session.url;
    } catch (error) {
      logger.error('Error creating checkout session', error);
      return null;
    }
  }

  async handleWebhook(body: string, signature: string): Promise<void> {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_mock';
    
    let event: Stripe.Event;

    if (stripeSecret === 'sk_test_mock') {
      logger.info('Mock Stripe webhook handler invoked');
      return;
    }

    try {
      event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    } catch (err: any) {
      logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new Error('Webhook Error');
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        
        if (userId) {
          await this.upgradeUserToPro(userId, session.subscription as string);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        // In a real app we'd map customer to user, for now log it
        logger.info(`Subscription ${subscription.id} deleted`);
        break;
      }
      default:
        logger.info(`Unhandled event type ${event.type}`);
    }
  }

  async upgradeUserToPro(userId: string, subscriptionId: string): Promise<void> {
    try {
      logger.info(`Upgrading user ${userId} to Pro (Sub: ${subscriptionId})`);
      const db = getDatabasePool();
      await db.query(
        `UPDATE users SET is_pro = true, stripe_subscription_id = $1 WHERE id = $2`,
        [subscriptionId, userId]
      );
    } catch (error) {
      logger.error(`Error upgrading user ${userId}:`, error);
    }
  }
}

export const billingService = new BillingService();

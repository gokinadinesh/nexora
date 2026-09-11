import { Request, Response } from 'express';
import { billingService } from '../services/billing.service';
import { logger } from '../utils/logger';

export class BillingController {
  async createCheckoutSession(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const url = await billingService.createCheckoutSession(user.id, user.email);
      
      if (!url) {
        res.status(500).json({ error: 'Failed to create checkout session' });
        return;
      }

      res.json({ url });
    } catch (error: any) {
      logger.error('Error in createCheckoutSession', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['stripe-signature'] as string;
      // Stripe needs raw body for signature verification
      // Make sure the route uses express.raw() middleware
      const body = req.body;
      
      await billingService.handleWebhook(body, signature);
      res.status(200).send('Webhook received');
    } catch (error: any) {
      logger.error('Error in handleWebhook', error);
      res.status(400).send(`Webhook Error: ${error.message}`);
    }
  }
}

export const billingController = new BillingController();

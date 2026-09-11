import { Router } from 'express';
import express from 'express';
import { billingController } from '../controllers/billing.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Requires authentication to create a checkout session
router.post('/checkout', requireAuth, billingController.createCheckoutSession);

export default router;

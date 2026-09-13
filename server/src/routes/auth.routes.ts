import { Router } from 'express';
import { authController } from '../controllers/auth.controller';

const router = Router();

// Firebase ID Token verification endpoint
router.post('/verify', (req, res, next) => authController.verify(req, res, next));

// Legacy compatibility routes
router.post('/register', (req, res, next) => authController.verify(req, res, next));
router.post('/login', (req, res, next) => authController.verify(req, res, next));
router.post('/google', (req, res, next) => authController.verify(req, res, next));

export default router;

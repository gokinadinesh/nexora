import { Request, Response, NextFunction } from 'express';
import { firestore } from '../config/firebase';

export const requireApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    res.status(401).json({ error: 'API key is required' });
    return;
  }

  try {
    const keySnap = await firestore
      .collection('developer_api_keys')
      .where('api_key', '==', apiKey)
      .limit(1)
      .get();

    if (keySnap.empty) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    const keyDoc = keySnap.docs[0];
    const keyData = keyDoc.data();

    if (!keyData.is_active) {
      res.status(401).json({ error: 'API key has been revoked' });
      return;
    }

    const userDoc = await firestore.collection('users').doc(keyData.user_id).get();
    if (!userDoc.exists) {
      res.status(401).json({ error: 'Associated user not found' });
      return;
    }

    const userData = userDoc.data()!;
    if (!userData.is_pro) {
      res.status(403).json({ error: 'Developer API access requires a Pro subscription' });
      return;
    }

    // Update last_used_at async
    keyDoc.ref.update({ last_used_at: new Date().toISOString() }).catch((err: any) => {
      console.error('Failed to update api key last_used_at:', err);
    });

    req.user = {
      id: userDoc.id,
      username: userData.username,
      email: userData.email,
      role: userData.role,
      isPro: userData.is_pro,
    } as any;

    next();
  } catch (error) {
    console.error('API key auth error:', error);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

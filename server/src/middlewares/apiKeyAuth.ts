import { Request, Response, NextFunction } from 'express';
import { getDatabasePool } from '../config/db';
import { User } from '@nexora/shared';

export const requireApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    res.status(401).json({ error: 'API key is required' });
    return;
  }

  try {
    const pool = getDatabasePool();
    
    // Check if the API key exists and is active
    const keyResult = await pool.query(
      `SELECT k.user_id, k.is_active, u.is_pro, u.id, u.username, u.email, u.role 
       FROM developer_api_keys k 
       JOIN users u ON k.user_id = u.id 
       WHERE k.api_key = $1`,
      [apiKey]
    );

    if (keyResult.rowCount === 0) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    const keyData = keyResult.rows[0];

    if (!keyData.is_active) {
      res.status(401).json({ error: 'API key has been revoked' });
      return;
    }

    if (!keyData.is_pro) {
      res.status(403).json({ error: 'Developer API access requires a Pro subscription' });
      return;
    }

    // Update last_used_at async
    pool.query(`UPDATE developer_api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE api_key = $1`, [apiKey]).catch((err: any) => {
      console.error('Failed to update api key last_used_at:', err);
    });

    req.user = {
      id: keyData.id,
      username: keyData.username,
      email: keyData.email,
      role: keyData.role,
      isPro: keyData.is_pro,
    } as any;

    next();
  } catch (error) {
    console.error('API key auth error:', error);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

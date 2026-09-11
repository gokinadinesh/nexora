import { Request, Response } from 'express';
import { getDatabasePool } from '../config/db';
import crypto from 'crypto';

export const developerController = {
  // Endpoints for managing API keys (called from frontend by the user)
  async generateApiKey(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { name } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!name) {
        return res.status(400).json({ error: 'Key name is required' });
      }

      // Pro users only? Handled by Pro subscription logic, or maybe allow creation but they only work if Pro?
      // Let's enforce Pro here too just to be safe
      const pool = getDatabasePool();
      const userResult = await pool.query('SELECT is_pro FROM users WHERE id = $1', [userId]);
      if (userResult.rowCount === 0 || !userResult.rows[0].is_pro) {
        return res.status(403).json({ error: 'Developer API access requires a Pro subscription' });
      }

      const apiKey = 'nex_' + crypto.randomBytes(32).toString('hex');

      const result = await pool.query(
        'INSERT INTO developer_api_keys (user_id, api_key, name) VALUES ($1, $2, $3) RETURNING id, name, created_at',
        [userId, apiKey, name]
      );

      res.status(201).json({
        id: result.rows[0].id,
        name: result.rows[0].name,
        apiKey, // Only show it once
        createdAt: result.rows[0].created_at,
      });
    } catch (error: any) {
      console.error('Error generating API key:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async listApiKeys(req: Request, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const pool = getDatabasePool();
      const result = await pool.query(
        'SELECT id, name, is_active, created_at, last_used_at FROM developer_api_keys WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );

      res.json(result.rows);
    } catch (error) {
      console.error('Error listing API keys:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async revokeApiKey(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const keyId = req.params.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const pool = getDatabasePool();
      const result = await pool.query(
        'UPDATE developer_api_keys SET is_active = false WHERE id = $1 AND user_id = $2 RETURNING id',
        [keyId, userId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'API key not found' });
      }

      res.json({ success: true, message: 'API key revoked' });
    } catch (error) {
      console.error('Error revoking API key:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // API Endpoints called via API key (Developer API)
  async getGlobalLeaderboard(req: Request, res: Response) {
    try {
      const pool = getDatabasePool();
      const result = await pool.query(
        `SELECT username, display_name, rating, wins, matches_played
         FROM users 
         ORDER BY rating DESC 
         LIMIT 100`
      );

      res.json({
        data: result.rows.map((row: any) => ({
          username: row.username,
          displayName: row.display_name,
          rating: row.rating,
          wins: row.wins,
          matchesPlayed: row.matches_played
        }))
      });
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getPlayerStats(req: Request, res: Response) {
    try {
      const username = req.params.username;
      
      const pool = getDatabasePool();
      const result = await pool.query(
        `SELECT username, display_name, rating, wins, losses, matches_played, current_win_streak
         FROM users 
         WHERE username = $1`,
        [username]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Player not found' });
      }

      const row = result.rows[0];
      res.json({
        data: {
          username: row.username,
          displayName: row.display_name,
          rating: row.rating,
          wins: row.wins,
          losses: row.losses,
          matchesPlayed: row.matches_played,
          winStreak: row.current_win_streak
        }
      });
    } catch (error) {
      console.error('Error getting player stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

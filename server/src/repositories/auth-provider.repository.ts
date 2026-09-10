import { getDatabasePool } from '../config/db';

export interface AuthProviderRow {
  id: string;
  user_id: string;
  provider_name: string;
  provider_sub: string;
  created_at: Date;
}

export interface IAuthProviderRepository {
  findByProvider(providerName: string, providerSub: string): Promise<AuthProviderRow | null>;
  linkProvider(userId: string, providerName: string, providerSub: string): Promise<AuthProviderRow>;
}

export class PostgresAuthProviderRepository implements IAuthProviderRepository {
  async findByProvider(providerName: string, providerSub: string): Promise<AuthProviderRow | null> {
    const pool = getDatabasePool();
    const query = `
      SELECT id, user_id, provider_name, provider_sub, created_at
      FROM player_auth_providers
      WHERE provider_name = $1 AND provider_sub = $2
      LIMIT 1
    `;
    const result = await pool.query<AuthProviderRow>(query, [providerName, providerSub]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async linkProvider(userId: string, providerName: string, providerSub: string): Promise<AuthProviderRow> {
    const pool = getDatabasePool();
    const query = `
      INSERT INTO player_auth_providers (user_id, provider_name, provider_sub)
      VALUES ($1, $2, $3)
      RETURNING id, user_id, provider_name, provider_sub, created_at
    `;
    try {
      const result = await pool.query<AuthProviderRow>(query, [userId, providerName, providerSub]);
      return result.rows[0];
    } catch (error: any) {
      if (error.code === '23505') {
        const conflictError: any = new Error('This provider account is already linked to a user');
        conflictError.statusCode = 409;
        throw conflictError;
      }
      throw error;
    }
  }
}

export const authProviderRepository = new PostgresAuthProviderRepository();

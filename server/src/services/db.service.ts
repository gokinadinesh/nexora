import { getDatabasePool } from '../config/db';

export interface QueryResponse<T = any> {
  rows: T[];
  rowCount: number | null;
}

export const dbService = {
  /**
   * Execute a query against the active database pool.
   */
  async query<T = any>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResponse<T>> {
    const pool = getDatabasePool();
    return pool.query<T>(text, params);
  },
};

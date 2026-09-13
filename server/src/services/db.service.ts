export interface QueryResponse<T = any> {
  rows: T[];
  rowCount: number | null;
}

export const dbService = {
  /**
   * Deprecated stub: Postgres replaced with Firestore.
   */
  async query<T = any>(_text: string, _params?: unknown[]): Promise<QueryResponse<T>> {
    return { rows: [], rowCount: 0 };
  },
};

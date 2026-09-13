import { randomUUID } from 'crypto';
import { firestore } from '../config/firebase';

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

export class FirestoreAuthProviderRepository implements IAuthProviderRepository {
  private collection = firestore.collection('player_auth_providers');

  async findByProvider(providerName: string, providerSub: string): Promise<AuthProviderRow | null> {
    const snap = await this.collection
      .where('provider_name', '==', providerName)
      .where('provider_sub', '==', providerSub)
      .limit(1)
      .get();

    if (snap.empty) return null;
    const data = snap.docs[0].data();
    return {
      id: snap.docs[0].id,
      user_id: data.user_id,
      provider_name: data.provider_name,
      provider_sub: data.provider_sub,
      created_at: data.created_at ? new Date(data.created_at) : new Date(),
    };
  }

  async linkProvider(userId: string, providerName: string, providerSub: string): Promise<AuthProviderRow> {
    const existing = await this.findByProvider(providerName, providerSub);
    if (existing) {
      const conflictError: any = new Error('This provider account is already linked to a user');
      conflictError.statusCode = 409;
      throw conflictError;
    }

    const id = randomUUID();
    const now = new Date();
    await this.collection.doc(id).set({
      id,
      user_id: userId,
      provider_name: providerName,
      provider_sub: providerSub,
      created_at: now.toISOString(),
    });

    return {
      id,
      user_id: userId,
      provider_name: providerName,
      provider_sub: providerSub,
      created_at: now,
    };
  }
}

export const authProviderRepository: IAuthProviderRepository = new FirestoreAuthProviderRepository();

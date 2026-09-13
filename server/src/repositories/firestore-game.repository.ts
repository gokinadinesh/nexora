import { randomUUID } from 'crypto';
import { FullGameState } from '@nexora/shared';
import { firestore, QueryDocumentSnapshot } from '../config/firebase';
import { logger } from '../utils/logger';
import { IGameRepository } from './game.repository';

export class FirestoreGameRepository implements IGameRepository {
  private gameStatesCollection = firestore.collection('game_states');
  private matchEventsCollection = firestore.collection('match_events');
  private replayRecordsCollection = firestore.collection('replay_records');

  async saveGameState(matchId: string, version: number, state: FullGameState): Promise<void> {
    try {
      const docId = `${matchId}_${version}`;
      await this.gameStatesCollection.doc(docId).set({
        id: docId,
        match_id: matchId,
        state_version: version,
        state_json: state,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      logger.error(`FirestoreGameRepo: Error saving game state for match ${matchId}:`, err);
    }
  }

  async recordMatchEvent(
    matchId: string,
    playerId: string | null,
    eventType: string,
    eventData: any = {}
  ): Promise<void> {
    try {
      const id = randomUUID();
      await this.matchEventsCollection.doc(id).set({
        id,
        match_id: matchId,
        player_id: playerId,
        event_type: eventType,
        event_data: eventData,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logger.error(`FirestoreGameRepo: Error recording match event for match ${matchId}:`, err);
    }
  }

  async getLatestGameState(matchId: string): Promise<FullGameState | null> {
    try {
      const snap = await this.gameStatesCollection
        .where('match_id', '==', matchId)
        .orderBy('state_version', 'desc')
        .limit(1)
        .get();

      if (snap.empty) return null;
      const data = snap.docs[0].data();
      const state = data.state_json;
      return typeof state === 'string' ? JSON.parse(state) : state;
    } catch (err) {
      logger.error(`FirestoreGameRepo: Error fetching latest game state for match ${matchId}:`, err);
      return null;
    }
  }

  async getMatchEvents(matchId: string, limit = 50): Promise<any[]> {
    try {
      const snap = await this.matchEventsCollection
        .where('match_id', '==', matchId)
        .orderBy('timestamp', 'asc')
        .limit(limit)
        .get();

      return snap.docs.map((doc: QueryDocumentSnapshot) => doc.data());
    } catch (err) {
      logger.error(`FirestoreGameRepo: Error fetching match events for match ${matchId}:`, err);
      return [];
    }
  }

  async getAllGameStates(matchId: string): Promise<{ state_version: number; state_json: FullGameState }[]> {
    try {
      const snap = await this.gameStatesCollection
        .where('match_id', '==', matchId)
        .orderBy('state_version', 'asc')
        .get();

      return snap.docs.map((doc: QueryDocumentSnapshot) => {
        const data = doc.data();
        return {
          state_version: data.state_version,
          state_json: typeof data.state_json === 'string' ? JSON.parse(data.state_json) : data.state_json,
        };
      });
    } catch (err) {
      logger.error(`FirestoreGameRepo: Error fetching all game states for match ${matchId}:`, err);
      return [];
    }
  }

  async persistReplay(
    matchId: string,
    durationSeconds: number,
    initialState: FullGameState,
    eventTimeline: any[],
    finalState: FullGameState | null
  ): Promise<void> {
    const id = matchId; // Use matchId directly for fast lookups
    await this.replayRecordsCollection.doc(id).set({
      id,
      match_id: matchId,
      duration_seconds: durationSeconds,
      initial_state: initialState,
      event_timeline: eventTimeline,
      final_state: finalState,
      replay_version: 1,
      created_at: new Date().toISOString(),
    });
  }

  async getReplay(matchId: string): Promise<any | null> {
    const doc = await this.replayRecordsCollection.doc(matchId).get();
    if (!doc.exists) return null;

    const row = doc.data()!;
    return {
      id: row.id,
      matchId: row.match_id,
      durationSeconds: row.duration_seconds,
      initialState: typeof row.initial_state === 'string' ? JSON.parse(row.initial_state) : row.initial_state,
      eventTimeline: typeof row.event_timeline === 'string' ? JSON.parse(row.event_timeline) : row.event_timeline,
      finalState: row.final_state ? (typeof row.final_state === 'string' ? JSON.parse(row.final_state) : row.final_state) : null,
      replayVersion: row.replay_version,
      createdAt: row.created_at,
    };
  }
}

export const firestoreGameRepository = new FirestoreGameRepository();

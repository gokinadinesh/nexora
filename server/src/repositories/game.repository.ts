import { FullGameState } from '@nexora/shared';
import { firestoreGameRepository, FirestoreGameRepository } from './firestore-game.repository';

export interface IGameRepository {
  saveGameState(matchId: string, version: number, state: FullGameState): Promise<void>;
  recordMatchEvent(
    matchId: string,
    playerId: string | null,
    eventType: string,
    eventData: any
  ): Promise<void>;
  getLatestGameState(matchId: string): Promise<FullGameState | null>;
  getMatchEvents(matchId: string, limit?: number): Promise<any[]>;
  getAllGameStates(matchId: string): Promise<{ state_version: number; state_json: FullGameState }[]>;
  persistReplay(matchId: string, durationSeconds: number, initialState: FullGameState, eventTimeline: any[], finalState: FullGameState | null): Promise<void>;
  getReplay(matchId: string): Promise<any | null>;
}

export { firestoreGameRepository, FirestoreGameRepository };
export const gameRepository: IGameRepository = firestoreGameRepository;

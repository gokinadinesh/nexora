import { useEffect, useState, useCallback, useRef } from 'react';
import {
  FullGameState,
  GameActionType,
  GameActionPayload,
  GAME_EVENTS,
  GameEventRecord,
  ActionRejectedPayload,
  MatchResultDetails,
} from '@nexora/shared';
import { getSocket } from '../services/socket';
import { matchService } from '../services/match.service';

export function useGameState(matchId?: string, currentUserId?: string) {
  const [gameState, setGameState] = useState<FullGameState | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [eventFeed, setEventFeed] = useState<GameEventRecord[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [matchResult, setMatchResult] = useState<MatchResultDetails | null>(null);

  const stateVersionRef = useRef<number>(0);

  // Sync ref with current version
  useEffect(() => {
    if (gameState) {
      stateVersionRef.current = gameState.version;
    }
  }, [gameState]);

  useEffect(() => {
    if (!matchId) return;

    const socket = getSocket();

    // 1. Initial State Handlers
    const handleGameStarted = (data: { matchId: string; state: FullGameState }) => {
      if (data.matchId === matchId) {
        setGameState(data.state);
        stateVersionRef.current = data.state.version;
      }
    };

    // 2. Authoritative State Updates (Reject Stale Versions)
    const handleStateUpdated = (incomingState: FullGameState) => {
      if (incomingState.matchId === matchId) {
        if (incomingState.version >= stateVersionRef.current) {
          setGameState(incomingState);
          stateVersionRef.current = incomingState.version;
          setIsSubmitting(false);
          setLastError(null);
        }
      }
    };

    // 3. Action Rejection
    const handleActionRejected = (payload: ActionRejectedPayload) => {
      setLastError(`[ACTION REJECTED] ${payload.reason}`);
      setIsSubmitting(false);
    };

    // Fetch result if match already completed on load
    matchService
      .getResult(matchId)
      .then((res) => setMatchResult(res))
      .catch(() => {
        // match still active or pending
      });

    // 4. Game Ended
    const handleGameEnded = (payload: {
      matchId: string;
      winnerId: string;
      state: FullGameState;
      result?: MatchResultDetails;
    }) => {
      if (payload.matchId === matchId) {
        setGameState(payload.state);
        stateVersionRef.current = payload.state.version;
        setIsSubmitting(false);

        if (payload.result) {
          setMatchResult(payload.result);
        } else {
          matchService.getResult(matchId).then((res) => setMatchResult(res)).catch(() => {});
        }
      }
    };

    // 5. Real-Time Action Log Events
    const handleActionEvent = (eventData: any) => {
      const record: GameEventRecord = {
        id: eventData.actionId || Math.random().toString(),
        matchId: matchId,
        playerId: eventData.playerId,
        type: eventData.type,
        message: eventData.message,
        timestamp: eventData.timestamp || Date.now(),
      };

      setEventFeed((prev) => [record, ...prev.slice(0, 19)]);
    };

    socket.on(GAME_EVENTS.GAME_STARTED, handleGameStarted);
    socket.on(GAME_EVENTS.GAME_STATE_UPDATED, handleStateUpdated);
    socket.on(GAME_EVENTS.ACTION_REJECTED, handleActionRejected);
    socket.on(GAME_EVENTS.GAME_ENDED, handleGameEnded);

    socket.on(GAME_EVENTS.PLAYER_MOVE, handleActionEvent);
    socket.on(GAME_EVENTS.NODE_CAPTURED, handleActionEvent);
    socket.on(GAME_EVENTS.PLAYER_ATTACKED, handleActionEvent);
    socket.on(GAME_EVENTS.PLAYER_DEFENDED, handleActionEvent);

    return () => {
      socket.off(GAME_EVENTS.GAME_STARTED, handleGameStarted);
      socket.off(GAME_EVENTS.GAME_STATE_UPDATED, handleStateUpdated);
      socket.off(GAME_EVENTS.ACTION_REJECTED, handleActionRejected);
      socket.off(GAME_EVENTS.GAME_ENDED, handleGameEnded);

      socket.off(GAME_EVENTS.PLAYER_MOVE, handleActionEvent);
      socket.off(GAME_EVENTS.NODE_CAPTURED, handleActionEvent);
      socket.off(GAME_EVENTS.PLAYER_ATTACKED, handleActionEvent);
      socket.off(GAME_EVENTS.PLAYER_DEFENDED, handleActionEvent);
    };
  }, [matchId]);

  /**
   * Dispatches a player action with unique actionId for idempotency.
   */
  const dispatchAction = useCallback(
    (type: GameActionType, targetNodeId?: string) => {
      if (!matchId) return;

      setLastError(null);
      setIsSubmitting(true);

      const actionId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const payload: GameActionPayload = {
        matchId,
        actionId,
        type,
        targetNodeId,
      };

      const socket = getSocket();
      socket.emit(GAME_EVENTS.PLAYER_ACTION, payload);
    },
    [matchId]
  );

  const isMyTurn = Boolean(
    gameState && currentUserId && gameState.turnPlayerId === currentUserId && gameState.status === 'ACTIVE'
  );

  return {
    gameState,
    selectedNodeId,
    setSelectedNodeId,
    eventFeed,
    lastError,
    isSubmitting,
    isMyTurn,
    dispatchAction,
    matchResult,
  };
}

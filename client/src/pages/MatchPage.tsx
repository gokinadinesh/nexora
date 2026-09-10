import React, { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GAME_EVENTS, GridNode } from '@nexora/shared';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { useGameState } from '../hooks/useGameState';
import { getSocket } from '../services/socket';

export const MatchPage: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { isConnected } = useSocket();
  const navigate = useNavigate();
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  const {
    gameState,
    selectedNodeId,
    setSelectedNodeId,
    eventFeed,
    lastError,
    isSubmitting,
    isMyTurn,
    dispatchAction,
    matchResult,
  } = useGameState(matchId, user?.id);

  // Join match room on mount
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
      return;
    }

    if (matchId) {
      const socket = getSocket();
      socket.emit(GAME_EVENTS.PLAYER_JOINED, { matchId });
    }
  }, [matchId, isAuthenticated, isLoading, navigate]);

  // Auto-scroll combat terminal to bottom on new events
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [eventFeed]);

  if (isLoading || !gameState) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="cyber-badge status-ok pulse">
          <span className="indicator-dot" />
          <span>SYNCHRONIZING CYBERGRID REAL-TIME COMBAT ARENA...</span>
        </div>
      </div>
    );
  }

  const p1 = Object.values(gameState.players)[0];
  const p2 = Object.values(gameState.players)[1];
  const myPlayer = user ? gameState.players[user.id] : undefined;
  const opponentPlayer = Object.values(gameState.players).find((p) => p.id !== user?.id);

  const myPosition = myPlayer?.position || 'N00';
  const selectedNode = selectedNodeId ? gameState.grid[selectedNodeId] : null;

  // Helper for Manhattan adjacency calculation
  const isAdjacent = (targetId: string): boolean => {
    if (!myPosition || myPosition === targetId) return false;
    const r1 = parseInt(myPosition[1], 10);
    const c1 = parseInt(myPosition[2], 10);
    const r2 = parseInt(targetId[1], 10);
    const c2 = parseInt(targetId[2], 10);
    return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
  };

  const isSelectedAdjacent = selectedNodeId ? isAdjacent(selectedNodeId) : false;

  // Action eligibility checks
  const canMove = isMyTurn && isSelectedAdjacent && selectedNode?.owner !== (opponentPlayer?.role || '');
  const canCapture = isMyTurn && isSelectedAdjacent && selectedNode?.owner === 'NEUTRAL';
  const canAttack = isMyTurn && isSelectedAdjacent && selectedNode?.owner === opponentPlayer?.role;
  const canDefend = isMyTurn && gameState.grid[myPosition]?.owner === myPlayer?.role && !gameState.grid[myPosition]?.isDefended;

  // Progress to 500 target
  const p1Progress = Math.min(100, Math.round(((p1?.score || 0) / 500) * 100));
  const p2Progress = Math.min(100, Math.round(((p2?.score || 0) / 500) * 100));

  // Render 5x5 Grid Rows
  const renderGrid = () => {
    const rows = [0, 1, 2, 3, 4];
    const cols = [0, 1, 2, 3, 4];

    return (
      <div
        style={{
          display: 'grid',
          gridTemplateRows: 'repeat(5, 1fr)',
          gap: '12px',
          width: '100%',
          maxWidth: '580px',
          aspectRatio: '1 / 1',
          margin: '0 auto',
        }}
      >
        {rows.map((row) => (
          <div key={row} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
            {cols.map((col) => {
              const nodeId = `N${row}${col}`;
              const node: GridNode = gameState.grid[nodeId];
              const isSelected = selectedNodeId === nodeId;
              const isP1Owner = node.owner === 'PLAYER_1';
              const isP2Owner = node.owner === 'PLAYER_2';
              const isNeutral = node.owner === 'NEUTRAL';
              const isSpecial = node.type === 'SPECIAL';

              const hasP1Token = p1?.position === nodeId;
              const hasP2Token = p2?.position === nodeId;
              const adjacentToMe = isAdjacent(nodeId);

              let borderColor = 'var(--border-subtle)';
              let bgColor = 'var(--bg-surface-elevated)';
              let glow = 'none';

              if (isP1Owner) {
                borderColor = 'var(--accent-cyan)';
                bgColor = 'rgba(0, 240, 255, 0.09)';
                glow = '0 0 12px rgba(0, 240, 255, 0.2)';
              } else if (isP2Owner) {
                borderColor = 'var(--accent-magenta)';
                bgColor = 'rgba(255, 0, 85, 0.09)';
                glow = '0 0 12px rgba(255, 0, 85, 0.2)';
              }

              if (isSpecial) {
                if (isNeutral) {
                  borderColor = 'rgba(255, 184, 0, 0.6)';
                  glow = '0 0 16px rgba(255, 184, 0, 0.25)';
                }
              }

              if (isSelected) {
                borderColor = '#ffffff';
                glow = '0 0 18px rgba(255, 255, 255, 0.7)';
              } else if (adjacentToMe && isMyTurn) {
                borderColor = 'var(--accent-green)';
                glow = '0 0 12px rgba(0, 255, 136, 0.35)';
              }

              return (
                <button
                  key={nodeId}
                  type="button"
                  onClick={() => setSelectedNodeId(nodeId)}
                  style={{
                    border: `2px solid ${borderColor}`,
                    background: bgColor,
                    boxShadow: glow,
                    borderRadius: '6px',
                    padding: '8px 6px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    position: 'relative',
                    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                    minHeight: '84px',
                    outline: 'none',
                  }}
                >
                  {/* Node Header: ID & Special Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.7rem',
                        color: isSelected ? '#ffffff' : 'var(--text-muted)',
                        fontWeight: isSelected ? 700 : 400,
                      }}
                    >
                      {nodeId}
                    </span>
                    {isSpecial && (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--accent-amber)',
                          background: 'rgba(255, 184, 0, 0.2)',
                          border: '1px solid rgba(255, 184, 0, 0.4)',
                          padding: '1px 5px',
                          borderRadius: '2px',
                          fontWeight: 800,
                        }}
                        title="Special Central Node: 200 PTS"
                      >
                        ★ 200
                      </span>
                    )}
                  </div>

                  {/* Operative Tokens or Node Center Symbol */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                    {hasP1Token && (
                      <div
                        style={{
                          padding: '2px 8px',
                          background: 'var(--accent-cyan)',
                          color: '#050811',
                          fontFamily: 'var(--font-display)',
                          fontSize: '0.7rem',
                          fontWeight: 900,
                          borderRadius: '3px',
                          boxShadow: '0 0 10px var(--accent-cyan)',
                          letterSpacing: '0.05em',
                        }}
                      >
                        ▲ {p1?.displayName?.slice(0, 5).toUpperCase() || 'P1'}
                      </div>
                    )}
                    {hasP2Token && (
                      <div
                        style={{
                          padding: '2px 8px',
                          background: 'var(--accent-magenta)',
                          color: '#ffffff',
                          fontFamily: 'var(--font-display)',
                          fontSize: '0.7rem',
                          fontWeight: 900,
                          borderRadius: '3px',
                          boxShadow: '0 0 10px var(--accent-magenta)',
                          letterSpacing: '0.05em',
                        }}
                      >
                        ▼ {p2?.displayName?.slice(0, 5).toUpperCase() || 'P2'}
                      </div>
                    )}
                    {!hasP1Token && !hasP2Token && (
                      <div
                        style={{
                          fontSize: '1rem',
                          color: isSelected ? '#ffffff' : isNeutral ? 'var(--text-muted)' : borderColor,
                          lineHeight: 1,
                        }}
                      >
                        {isNeutral ? '○' : '◈'}
                      </div>
                    )}
                  </div>

                  {/* Node Footer: Shield Status & Owner Value */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    {node.isDefended ? (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.65rem',
                          color: 'var(--accent-cyan)',
                          background: 'rgba(0, 240, 255, 0.25)',
                          border: '1px solid var(--accent-cyan)',
                          padding: '1px 5px',
                          borderRadius: '2px',
                          fontWeight: 800,
                        }}
                      >
                        🛡 SHIELD
                      </span>
                    ) : (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        {isP1Owner ? 'P1' : isP2Owner ? 'P2' : 'NEUTRAL'}
                      </span>
                    )}

                    {adjacentToMe && isMyTurn && (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.6rem',
                          color: 'var(--accent-green)',
                          fontWeight: 700,
                        }}
                      >
                        TARGET
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 20px',
        maxWidth: '1280px',
        width: '100%',
        margin: '0 auto',
        gap: '20px',
      }}
    >
      {/* Top HUD: Combat Protocol Bar */}
      <div
        className="cyber-card"
        style={{
          padding: '16px 28px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--accent-cyan)', letterSpacing: '0.15em' }}>
            [CYBERGRID COMBAT ARENA // 5X5 SERVER-AUTHORITATIVE ENGINE]
          </div>
          <h1 style={{ fontSize: '1.7rem', letterSpacing: '0.08em', color: 'var(--text-primary)', margin: '4px 0' }}>
            NEXORA BATTLE ARENA
          </h1>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            SESSION: <span style={{ color: 'var(--accent-cyan)' }}>{gameState.matchId}</span> • PROTOCOL:{' '}
            <span style={{ color: 'var(--accent-amber)', fontWeight: 700 }}>STATE v{gameState.version}</span> • TURN #{gameState.turnNumber} • SOCKET:{' '}
            <span style={{ color: isConnected ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 700 }}>
              {isConnected ? 'ONLINE (AUTHORITATIVE)' : 'RECONNECTING...'}
            </span>
          </div>
        </div>

        {/* Dynamic Turn Status Banner */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          {isMyTurn ? (
            <div
              style={{
                padding: '10px 20px',
                background: 'rgba(0, 240, 255, 0.15)',
                border: '2px solid var(--accent-cyan)',
                borderRadius: '6px',
                boxShadow: 'var(--glow-cyan)',
                fontFamily: 'var(--font-display)',
                fontSize: '1rem',
                color: 'var(--accent-cyan)',
                fontWeight: 800,
                letterSpacing: '0.08em',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span className="indicator-dot pulse" style={{ background: 'var(--accent-cyan)' }} />
              <span>YOUR TURN // EXECUTE AUTHORITATIVE ACTION</span>
            </div>
          ) : (
            <div
              style={{
                padding: '10px 20px',
                background: 'rgba(255, 184, 0, 0.1)',
                border: '1px solid var(--accent-amber)',
                borderRadius: '6px',
                fontFamily: 'var(--font-display)',
                fontSize: '1rem',
                color: 'var(--accent-amber)',
                letterSpacing: '0.08em',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span className="indicator-dot pulse" style={{ background: 'var(--accent-amber)' }} />
              <span>OPPONENT TRANSMITTING // MONITORING GRID</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => navigate('/lobby')}
            className="btn-cyber-ghost"
            style={{ padding: '8px 16px', fontSize: '0.8rem' }}
          >
            ← LOBBY
          </button>
        </div>
      </div>

      {/* Action Error / Validation Alert */}
      {lastError && (
        <div className="cyber-alert cyber-alert-danger" role="alert">
          <span>⚠</span>
          <span>ACTION REJECTED BY SERVER: {lastError}</span>
        </div>
      )}

      {/* Operatives Comparative Scoreboard with Target Progress */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          gap: '16px',
          alignItems: 'center',
        }}
      >
        {/* Player 1 HUD Card */}
        <div
          className="cyber-card"
          style={{
            padding: '18px 24px',
            border: '2px solid var(--accent-cyan)',
            boxShadow: myPlayer?.role === 'PLAYER_1' ? '0 0 20px rgba(0, 240, 255, 0.25)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                PLAYER 01 {myPlayer?.role === 'PLAYER_1' ? '(YOU)' : ''}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: 'var(--text-primary)', fontWeight: 700, marginTop: '2px' }}>
                {p1?.displayName || 'Operative 1'}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                NODE: <span style={{ color: '#ffffff', fontWeight: 700 }}>{p1?.position}</span>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>SCORE</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', color: 'var(--accent-cyan)', fontWeight: 900, lineHeight: 1 }}>
                {p1?.score || 0}
              </div>
            </div>
          </div>

          {/* Progress Bar towards 500 PTS */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '4px' }}>
              <span>GOAL PROGRESS</span>
              <span>{p1Progress}%</span>
            </div>
            <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${p1Progress}%`,
                  background: 'var(--accent-cyan)',
                  boxShadow: '0 0 8px var(--accent-cyan)',
                  transition: 'width 0.4s ease-out',
                }}
              />
            </div>
          </div>
        </div>

        {/* Central Win Condition Gauge */}
        <div
          style={{
            textAlign: 'center',
            padding: '12px 20px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            VICTORY THRESHOLD
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.6rem',
              color: 'var(--accent-amber)',
              fontWeight: 900,
              textShadow: '0 0 10px rgba(255, 184, 0, 0.4)',
              margin: '2px 0',
            }}
          >
            500 PTS
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--accent-cyan)' }}>
            FIRST TO REACH
          </div>
        </div>

        {/* Player 2 HUD Card */}
        <div
          className="cyber-card"
          style={{
            padding: '18px 24px',
            border: '2px solid var(--accent-magenta)',
            boxShadow: myPlayer?.role === 'PLAYER_2' ? '0 0 20px rgba(255, 0, 85, 0.25)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--accent-magenta)', fontWeight: 700 }}>
                PLAYER 02 {myPlayer?.role === 'PLAYER_2' ? '(YOU)' : ''}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: 'var(--text-primary)', fontWeight: 700, marginTop: '2px' }}>
                {p2?.displayName || 'Operative 2'}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                NODE: <span style={{ color: '#ffffff', fontWeight: 700 }}>{p2?.position}</span>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>SCORE</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', color: 'var(--accent-magenta)', fontWeight: 900, lineHeight: 1 }}>
                {p2?.score || 0}
              </div>
            </div>
          </div>

          {/* Progress Bar towards 500 PTS */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '4px' }}>
              <span>GOAL PROGRESS</span>
              <span>{p2Progress}%</span>
            </div>
            <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${p2Progress}%`,
                  background: 'var(--accent-magenta)',
                  boxShadow: '0 0 8px var(--accent-magenta)',
                  transition: 'width 0.4s ease-out',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Battle Area: 5x5 CyberGrid & Tactical Action Dock */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(320px, 600px) 1fr',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* Center: 5x5 Interactive CyberGrid */}
        <div className="cyber-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              NEURAL GRID TOPOLOGY (25 NODES // AUTHORITATIVE)
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              TARGETED NODE: <span style={{ color: '#ffffff', fontWeight: 700 }}>{selectedNodeId || 'NONE SELECTED'}</span>
            </div>
          </div>

          {renderGrid()}

          <div
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '16px',
              paddingTop: '12px',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
            }}
          >
            <span>■ P1 (CYAN)</span>
            <span>■ P2 (MAGENTA)</span>
            <span>★ SPECIAL (+200 PTS)</span>
            <span>🛡 SHIELDED</span>
          </div>
        </div>

        {/* Right Column: Tactical Actions & Real-Time Terminal Log */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Tactical Action Dock */}
          <div className="cyber-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                TACTICAL ACTION DOCK
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: isMyTurn ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                {isMyTurn ? '● ACTIONS READY' : '○ AWAITING TURN'}
              </span>
            </div>

            {selectedNode ? (
              <div
                style={{
                  background: 'var(--bg-surface-elevated)',
                  padding: '14px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.8rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    TARGET: <strong style={{ color: '#ffffff' }}>{selectedNode.id}</strong> (Row {selectedNode.row}, Col {selectedNode.col})
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: isSelectedAdjacent ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 700 }}>
                    {isSelectedAdjacent ? '✓ ADJACENT' : '✖ NOT ADJACENT'}
                  </span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  OWNER: <strong style={{ color: 'var(--accent-cyan)' }}>{selectedNode.owner}</strong> • VALUE:{' '}
                  <strong style={{ color: 'var(--accent-amber)' }}>+{selectedNode.value} PTS</strong>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', color: selectedNode.isDefended ? 'var(--accent-amber)' : 'var(--text-muted)', marginTop: '4px' }}>
                  ENERGY SHIELD: {selectedNode.isDefended ? 'ACTIVE (BLOCKS FIRST ATTACK)' : 'OFFLINE'}
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: 'var(--bg-surface-elevated)',
                  padding: '14px',
                  borderRadius: '6px',
                  border: '1px dashed var(--border-subtle)',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                CLICK ANY GREEN-HIGHLIGHTED ADJACENT NODE TO TARGET
              </div>
            )}

            {/* Action Command Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              {/* MOVE */}
              <button
                type="button"
                disabled={!canMove || isSubmitting}
                onClick={() => selectedNodeId && dispatchAction('MOVE', selectedNodeId)}
                className="btn-cyber-primary"
                style={{
                  padding: '14px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  opacity: canMove ? 1 : 0.4,
                  cursor: canMove ? 'pointer' : 'not-allowed',
                }}
              >
                <span style={{ fontSize: '0.95rem', fontWeight: 800, letterSpacing: '0.08em' }}>MOVE</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.8, fontFamily: 'var(--font-mono)' }}>Advance Position</span>
              </button>

              {/* CAPTURE */}
              <button
                type="button"
                disabled={!canCapture || isSubmitting}
                onClick={() => selectedNodeId && dispatchAction('CAPTURE', selectedNodeId)}
                className="btn-cyber-primary"
                style={{
                  padding: '14px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  borderColor: 'var(--accent-amber)',
                  color: 'var(--accent-amber)',
                  opacity: canCapture ? 1 : 0.4,
                  cursor: canCapture ? 'pointer' : 'not-allowed',
                }}
              >
                <span style={{ fontSize: '0.95rem', fontWeight: 800, letterSpacing: '0.08em' }}>CAPTURE</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.8, fontFamily: 'var(--font-mono)' }}>+100 PTS (Neutral)</span>
              </button>

              {/* ATTACK */}
              <button
                type="button"
                disabled={!canAttack || isSubmitting}
                onClick={() => selectedNodeId && dispatchAction('ATTACK', selectedNodeId)}
                className="btn-cyber-primary"
                style={{
                  padding: '14px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  borderColor: 'var(--accent-magenta)',
                  color: 'var(--accent-magenta)',
                  opacity: canAttack ? 1 : 0.4,
                  cursor: canAttack ? 'pointer' : 'not-allowed',
                }}
              >
                <span style={{ fontSize: '0.95rem', fontWeight: 800, letterSpacing: '0.08em' }}>ATTACK</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.8, fontFamily: 'var(--font-mono)' }}>+50 PTS (Enemy Node)</span>
              </button>

              {/* DEFEND */}
              <button
                type="button"
                disabled={!canDefend || isSubmitting}
                onClick={() => dispatchAction('DEFEND')}
                className="btn-cyber-secondary"
                style={{
                  padding: '14px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  opacity: canDefend ? 1 : 0.4,
                  cursor: canDefend ? 'pointer' : 'not-allowed',
                }}
              >
                <span style={{ fontSize: '0.95rem', fontWeight: 800, letterSpacing: '0.08em' }}>DEFEND</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.8, fontFamily: 'var(--font-mono)' }}>Deploy Energy Shield</span>
              </button>
            </div>
          </div>

          {/* Real-Time Tactical Terminal Log */}
          <div className="cyber-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                TACTICAL EVENT STREAM (AUDITED)
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--accent-cyan)' }}>
                {eventFeed.length} EVENTS LOGGED
              </span>
            </div>

            <div
              style={{
                background: '#040711',
                padding: '14px',
                borderRadius: '6px',
                minHeight: '180px',
                maxHeight: '220px',
                overflowY: 'auto',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {eventFeed.length === 0 ? (
                <div style={{ color: 'var(--text-muted)' }}>[AWAITING COMBAT ACTIONS ON GRID...]</div>
              ) : (
                eventFeed.map((evt) => {
                  let eventColor = 'var(--accent-cyan)';
                  if (evt.type === 'PLAYER_ATTACKED') eventColor = 'var(--accent-magenta)';
                  if (evt.type === 'NODE_CAPTURED') eventColor = 'var(--accent-green)';
                  if (evt.type === 'NODE_DEFENDED') eventColor = 'var(--accent-amber)';

                  return (
                    <div key={evt.id} style={{ color: eventColor, lineHeight: 1.4 }}>
                      <span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>
                        [{new Date(evt.timestamp).toLocaleTimeString()}]
                      </span>
                      {evt.message}
                    </div>
                  );
                })
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>
        </div>
      </div>

      {/* Grand Victory / Defeat Post-Match Modal */}
      {gameState.status === 'COMPLETED' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 17, 0.94)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
            animation: 'fadeIn 0.3s ease-out',
          }}
        >
          <div
            className="cyber-card"
            style={{
              maxWidth: '680px',
              width: '100%',
              padding: '40px',
              border: `2px solid ${gameState.winnerId === user?.id ? 'var(--accent-green)' : 'var(--accent-red)'}`,
              boxShadow: gameState.winnerId === user?.id
                ? '0 0 40px rgba(0, 255, 136, 0.35)'
                : '0 0 40px rgba(255, 68, 68, 0.35)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}
          >
            <div>
              <div
                className="cyber-badge"
                style={{
                  marginBottom: '12px',
                  display: 'inline-flex',
                  border: `1px solid ${gameState.winnerId === user?.id ? 'var(--accent-green)' : 'var(--accent-red)'}`,
                  color: gameState.winnerId === user?.id ? 'var(--accent-green)' : 'var(--accent-red)',
                }}
              >
                <span
                  className="indicator-dot pulse"
                  style={{ background: gameState.winnerId === user?.id ? 'var(--accent-green)' : 'var(--accent-red)' }}
                />
                <span>CYBERGRID ENGAGEMENT RESOLVED</span>
              </div>

              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '2.8rem',
                  letterSpacing: '0.12em',
                  color: gameState.winnerId === user?.id ? 'var(--accent-green)' : 'var(--accent-red)',
                  margin: '4px 0',
                  textShadow: gameState.winnerId === user?.id
                    ? '0 0 20px rgba(0, 255, 136, 0.6)'
                    : '0 0 20px rgba(255, 68, 68, 0.6)',
                }}
              >
                {gameState.winnerId === user?.id ? 'VICTORY ACHIEVED' : gameState.winnerId ? 'GRID SEVERED (DEFEAT)' : 'ENGAGEMENT DRAW'}
              </h2>

              {matchResult && (
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)',
                    marginTop: '6px',
                  }}
                >
                  ENGAGEMENT DURATION: {matchResult.durationSeconds}s // PROTOCOL VERSION: v{matchResult.finalVersion}
                </div>
              )}
            </div>

            {/* Competitive Rating & Score Breakdown */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                background: 'var(--bg-surface-elevated)',
                padding: '24px',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {matchResult && matchResult.players.length > 0 ? (
                matchResult.players.map((p) => {
                  const isMe = p.userId === user?.id;
                  const deltaPositive = p.ratingChange >= 0;
                  return (
                    <div
                      key={p.userId}
                      style={{
                        padding: '16px',
                        borderRadius: '6px',
                        background: isMe ? 'rgba(0, 240, 255, 0.08)' : 'transparent',
                        border: isMe ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                      }}
                    >
                      <div
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontWeight: 700,
                          fontSize: '1.1rem',
                          color: isMe ? 'var(--accent-cyan)' : 'var(--text-primary)',
                          marginBottom: '4px',
                        }}
                      >
                        {p.displayName || p.username} {isMe && '(YOU)'}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '2.4rem',
                          color: p.isWinner ? 'var(--accent-green)' : 'var(--text-primary)',
                          fontWeight: 900,
                        }}
                      >
                        {p.score} PTS
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.9rem',
                          marginTop: '6px',
                          color: deltaPositive ? 'var(--accent-green)' : 'var(--accent-red)',
                          fontWeight: 800,
                        }}
                      >
                        {p.ratingBefore} &rarr; {p.ratingAfter} ({deltaPositive ? `+${p.ratingChange}` : p.ratingChange} ELO)
                      </div>
                    </div>
                  );
                })
              ) : (
                Object.values(gameState.players).map((p) => (
                  <div key={p.id}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {p.displayName}
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--accent-cyan)', marginTop: '4px', fontWeight: 800 }}>
                      {p.score} PTS
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* CTAs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                type="button"
                onClick={() => navigate('/lobby')}
                className="btn-cyber-primary"
                style={{ padding: '16px', width: '100%', fontSize: '1.05rem', letterSpacing: '0.12em' }}
              >
                ⚡ PLAY AGAIN (ENTER COMMAND LOBBY)
              </button>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => navigate('/history')}
                  className="btn-cyber-secondary"
                  style={{ padding: '12px', fontSize: '0.85rem' }}
                >
                  VIEW MATCH AUDIT LOGS
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/leaderboard')}
                  className="btn-cyber-secondary"
                  style={{ padding: '12px', fontSize: '0.85rem' }}
                >
                  GLOBAL LEADERBOARD
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

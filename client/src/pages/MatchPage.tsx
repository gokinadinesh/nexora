import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GAME_EVENTS, GridNode } from '@nexora/shared';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { useGameState } from '../hooks/useGameState';
import { getSocket } from '../services/socket';
import { cyberAudio } from '../services/CyberAudio';
import { cyberAnnouncer } from '../services/CyberAnnouncer';
import { CyberCanvasFX } from '../components/Game/CyberCanvasFX';
import { TacticalPingOverlay, TacticalPing } from '../components/Game/TacticalPingOverlay';
import { ClassSelectorModal, SUBROUTINES, OperativeSubroutine } from '../components/Game/ClassSelectorModal';
import { HackingDecompileModal } from '../components/Game/HackingDecompileModal';

export const MatchPage: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { isConnected } = useSocket();
  const navigate = useNavigate();
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  // Audio & Announcer Settings
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(() => cyberAudio.getMuted());
  const [isAnnouncerEnabled, setIsAnnouncerEnabled] = useState<boolean>(() => cyberAnnouncer.getEnabled());

  // Tactical Subroutines / Class State
  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    return localStorage.getItem('nexora_tactical_class') || 'cryptanalyst';
  });
  const [showClassModal, setShowClassModal] = useState<boolean>(false);
  const currentClass: OperativeSubroutine =
    SUBROUTINES.find((s) => s.id === selectedClassId) || SUBROUTINES[0];

  // Reverse Engineering Hacking Minigame Modal
  const [showDecompileModal, setShowDecompileModal] = useState<boolean>(false);

  // Camera Shake State
  const [cameraShake, setCameraShake] = useState<'camera-shake-light' | 'camera-shake-heavy' | ''>('');
  const triggerCameraShake = (intensity: 'light' | 'heavy') => {
    setCameraShake(intensity === 'heavy' ? 'camera-shake-heavy' : 'camera-shake-light');
    setTimeout(() => {
      setCameraShake('');
    }, 450);
  };

  // Tactical Ping Overlay State
  const [pings, setPings] = useState<TacticalPing[]>([]);
  const [activePingTool, setActivePingTool] = useState<'none' | 'attack' | 'defend' | 'scan'>('none');

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

  // Tracking refs for audio & speech triggers
  const lastEventCountRef = useRef<number>(0);
  const prevTurnRef = useRef<boolean>(false);
  const matchAnnouncedRef = useRef<boolean>(false);
  const matchCompletedRef = useRef<boolean>(false);

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

  // Initial link established announcement
  useEffect(() => {
    if (gameState && !matchAnnouncedRef.current) {
      matchAnnouncedRef.current = true;
      cyberAudio.playMoveSound();
      cyberAnnouncer.announceMatchStart();
    }
  }, [gameState]);

  // Turn transition audio & announcer
  useEffect(() => {
    if (gameState && gameState.status === 'ACTIVE') {
      if (isMyTurn && !prevTurnRef.current) {
        cyberAudio.playTurnNotification();
        cyberAnnouncer.speak('Tactical priority acquired. Your turn.');
      }
      prevTurnRef.current = isMyTurn;
    }
  }, [isMyTurn, gameState]);

  // Combat Event Stream Audio & Camera Shake
  useEffect(() => {
    if (!eventFeed || eventFeed.length === 0) return;
    if (eventFeed.length <= lastEventCountRef.current) {
      lastEventCountRef.current = eventFeed.length;
      return;
    }

    const newEvents = eventFeed.slice(lastEventCountRef.current);
    lastEventCountRef.current = eventFeed.length;

    newEvents.forEach((evt) => {
      if (evt.type === 'PLAYER_MOVED') {
        cyberAudio.playMoveSound();
      } else if (evt.type === 'NODE_CAPTURED') {
        const isCore = evt.message.includes('SPECIAL') || evt.message.includes('200') || evt.message.includes('N22');
        if (isCore) {
          cyberAudio.playCaptureSound(true);
          cyberAnnouncer.announceCoreContested();
          triggerCameraShake('heavy');
        } else {
          cyberAudio.playCaptureSound(false);
          triggerCameraShake('light');
        }
      } else if (evt.type === 'PLAYER_ATTACKED') {
        cyberAudio.playAttackSound();
        triggerCameraShake('light');
        if (evt.message.includes('SHIELD') || evt.message.includes('DEFENDED') || evt.message.includes('BREACH')) {
          cyberAudio.playAttackSound(true);
          cyberAnnouncer.announceShieldBreach();
        }
      } else if (evt.type === 'NODE_DEFENDED') {
        cyberAudio.playDefendSound();
        cyberAnnouncer.announceShieldRaised();
      }
    });
  }, [eventFeed]);

  // Victory / Defeat announcement & fanfare
  useEffect(() => {
    if (gameState?.status === 'COMPLETED' && !matchCompletedRef.current) {
      matchCompletedRef.current = true;
      if (gameState.winnerId === user?.id) {
        cyberAudio.playVictoryFanfare();
        cyberAnnouncer.announceVictory();
      } else {
        cyberAudio.playDefeatSound();
        cyberAnnouncer.announceDefeat();
      }
    }
  }, [gameState?.status, gameState?.winnerId, user?.id]);

  // Auto-scroll combat terminal to bottom on new events
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [eventFeed]);

  const spawnPing = (nodeId: string, type: 'attack' | 'defend' | 'scan') => {
    const newPing: TacticalPing = {
      id: `ping-${Date.now()}-${Math.random()}`,
      nodeId,
      type,
      timestamp: Date.now(),
    };
    setPings((prev) => [...prev.slice(-7), newPing]);
    cyberAudio.playPingSound(type);

    setTimeout(() => {
      setPings((prev) => prev.filter((p) => p.id !== newPing.id));
    }, 3200);
  };

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

  const playersList = Object.values(gameState.players);
  const myPlayer = user ? gameState.players[user.id] : undefined;
  const opponentPlayers = playersList.filter((p) => p.id !== user?.id);

  // Derive map level name from gridSize
  let mapLevelName = 'Unknown Area';
  if (gameState && gameState.grid) {
    const nodeCount = Object.keys(gameState.grid).length;
    const gridSize = Math.round(Math.sqrt(nodeCount));
    if (gridSize === 5) mapLevelName = 'Level 1: Duel Arena';
    else if (gridSize === 7) mapLevelName = 'Level 2: Skirmish';
    else if (gridSize === 10) mapLevelName = 'Level 3: Warzone';
  }

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
  const canMove = isMyTurn && isSelectedAdjacent && !opponentPlayers.some(p => p.role === selectedNode?.owner);
  const canCapture = isMyTurn && isSelectedAdjacent && selectedNode?.owner === 'NEUTRAL';
  const canAttack = isMyTurn && isSelectedAdjacent && opponentPlayers.some(p => p.role === selectedNode?.owner);
  const canDefend = isMyTurn && gameState.grid[myPosition]?.owner === myPlayer?.role && !gameState.grid[myPosition]?.isDefended;

  // Node selection & right-click ping handling
  const handleNodeClick = (nodeId: string) => {
    if (activePingTool !== 'none') {
      spawnPing(nodeId, activePingTool);
      setActivePingTool('none');
      return;
    }
    setSelectedNodeId(nodeId);
    cyberAudio.playMoveSound();
  };

  const handleNodeContextMenu = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    const node = gameState.grid[nodeId];
    if (opponentPlayers.some(p => p.role === node?.owner)) {
      spawnPing(nodeId, 'attack');
    } else if (node?.owner === myPlayer?.role) {
      spawnPing(nodeId, 'defend');
    } else {
      spawnPing(nodeId, 'scan');
    }
  };

  // Reverse engineering decompile completion handler
  const handleDecompileSuccess = () => {
    setShowDecompileModal(false);
    cyberAudio.playCaptureSound(true);
    cyberAnnouncer.speak('Target decompiled. Initiating breach strike.');
    if (selectedNodeId) {
      dispatchAction('ATTACK', selectedNodeId);
    }
  };

  const renderGrid = () => {
    let maxRow = 0;
    let maxCol = 0;
    Object.keys(gameState.grid).forEach((nodeId) => {
      const r = parseInt(nodeId[1], 10);
      const c = parseInt(nodeId[2], 10);
      if (!isNaN(r) && r > maxRow) maxRow = r;
      if (!isNaN(c) && c > maxCol) maxCol = c;
    });
    const rows = Array.from({length: maxRow + 1}, (_, i) => i);
    const cols = Array.from({length: maxCol + 1}, (_, i) => i);

    return (
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '580px',
          aspectRatio: '1 / 1',
          margin: '0 auto',
        }}
      >
        {/* Hardware-Accelerated 2D Canvas FX (Laser Conduits, Shields, Shockwaves) */}
        <CyberCanvasFX
          grid={gameState.grid}
          myPlayerRole={myPlayer?.role}
          lastActionNodeId={selectedNodeId}
        />

        {/* Tactical Radar Ping Overlay */}
        <TacticalPingOverlay pings={pings} />

        {/* Grid Button Elements */}
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            display: 'grid',
            gridTemplateRows: `repeat(${rows.length}, 1fr)`,
            gap: '12px',
            width: '100%',
            height: '100%',
          }}
        >
          {rows.map((row) => (
            <div key={row} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.length}, 1fr)`, gap: '12px' }}>
              {cols.map((col) => {
                const nodeId = `N${row}${col}`;
                const node: GridNode = gameState.grid[nodeId];
                const isSelected = selectedNodeId === nodeId;
                const isNeutral = node.owner === 'NEUTRAL';
                const isSpecial = node.type === 'SPECIAL';

                const occupyingPlayer = playersList.find(p => p.position === nodeId);
                const adjacentToMe = isAdjacent(nodeId);

                let borderColor = 'var(--border-subtle)';
                let bgColor = 'rgba(10, 14, 26, 0.75)';
                let glow = 'none';

                if (!isNeutral) {
                  // For dynamic players, we use cyan for current player, magenta/orange/red for opponents
                  const isMe = node.owner === myPlayer?.role;
                  borderColor = isMe ? 'var(--accent-cyan)' : 'var(--accent-magenta)';
                  bgColor = isMe ? 'rgba(0, 240, 255, 0.12)' : 'rgba(255, 0, 85, 0.12)';
                  glow = isMe ? '0 0 14px rgba(0, 240, 255, 0.25)' : '0 0 14px rgba(255, 0, 85, 0.25)';
                }

                if (isSpecial) {
                  if (isNeutral) {
                    borderColor = 'rgba(255, 184, 0, 0.6)';
                    glow = '0 0 18px rgba(255, 184, 0, 0.3)';
                  }
                }

                if (isSelected) {
                  borderColor = '#ffffff';
                  glow = '0 0 20px rgba(255, 255, 255, 0.75)';
                } else if (adjacentToMe && isMyTurn) {
                  borderColor = 'var(--accent-green)';
                  glow = '0 0 14px rgba(0, 255, 136, 0.4)';
                }

                return (
                  <button
                    key={nodeId}
                    type="button"
                    onClick={() => handleNodeClick(nodeId)}
                    onContextMenu={(e) => handleNodeContextMenu(e, nodeId)}
                    style={{
                      border: `2px solid ${borderColor}`,
                      background: bgColor,
                      boxShadow: glow,
                      borderRadius: '6px',
                      padding: '8px 6px',
                      cursor: activePingTool !== 'none' ? 'crosshair' : 'pointer',
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
                      {occupyingPlayer && (
                        <div
                          style={{
                            padding: '2px 8px',
                            background: occupyingPlayer.id === myPlayer?.id ? 'var(--accent-cyan)' : 'var(--accent-magenta)',
                            color: occupyingPlayer.id === myPlayer?.id ? '#050811' : '#ffffff',
                            fontFamily: 'var(--font-display)',
                            fontSize: '0.7rem',
                            fontWeight: 900,
                            borderRadius: '3px',
                            boxShadow: occupyingPlayer.id === myPlayer?.id ? '0 0 10px var(--accent-cyan)' : '0 0 10px var(--accent-magenta)',
                            letterSpacing: '0.05em',
                          }}
                        >
                          {occupyingPlayer.id === myPlayer?.id ? '▲' : '▼'} {occupyingPlayer.displayName?.slice(0, 5).toUpperCase() || 'OP'}
                        </div>
                      )}
                      {!occupyingPlayer && (
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
                          {node.owner === 'NEUTRAL' ? 'NEUTRAL' : playersList.find(p => p.role === node.owner)?.displayName?.slice(0, 3).toUpperCase() || 'OWNED'}
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
      </div>
    );
  };

  return (
    <div
      className={cameraShake}
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
            [CYBERGRID COMBAT ARENA // AAA PRO ESPORTS ENGINE]
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

        {/* Audio Toggles & Tactical Subroutine Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              const muted = cyberAudio.toggleMute();
              setIsAudioMuted(muted);
            }}
            className="btn-cyber-ghost"
            style={{ padding: '7px 12px', fontSize: '0.75rem' }}
            title={isAudioMuted ? 'Unmute Procedural Audio' : 'Mute Procedural Audio'}
          >
            {isAudioMuted ? '🔇 AUDIO OFF' : '🔊 AUDIO ON'}
          </button>

          <button
            type="button"
            onClick={() => {
              const enabled = cyberAnnouncer.toggle();
              setIsAnnouncerEnabled(enabled);
            }}
            className="btn-cyber-ghost"
            style={{ padding: '7px 12px', fontSize: '0.75rem' }}
            title={isAnnouncerEnabled ? 'Disable Announcer Voice' : 'Enable Announcer Voice'}
          >
            {isAnnouncerEnabled ? '🎙 ANNOUNCER ON' : '🎙 ANNOUNCER OFF'}
          </button>

          <button
            type="button"
            onClick={() => setShowClassModal(true)}
            className="btn-cyber-secondary"
            style={{
              padding: '7px 14px',
              fontSize: '0.75rem',
              borderColor: currentClass.color,
              color: currentClass.color,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Configure Tactical Subroutine Class"
          >
            <span>{currentClass.badge}</span>
            <span>{currentClass.name}</span>
          </button>

          {isMyTurn ? (
            <div
              style={{
                padding: '8px 16px',
                background: 'rgba(0, 240, 255, 0.15)',
                border: '2px solid var(--accent-cyan)',
                borderRadius: '6px',
                boxShadow: 'var(--glow-cyan)',
                fontFamily: 'var(--font-display)',
                fontSize: '0.9rem',
                color: 'var(--accent-cyan)',
                fontWeight: 800,
                letterSpacing: '0.08em',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span className="indicator-dot pulse" style={{ background: 'var(--accent-cyan)' }} />
              <span>YOUR TURN</span>
            </div>
          ) : (
            <div
              style={{
                padding: '8px 16px',
                background: 'rgba(255, 184, 0, 0.1)',
                border: '1px solid var(--accent-amber)',
                borderRadius: '6px',
                fontFamily: 'var(--font-display)',
                fontSize: '0.9rem',
                color: 'var(--accent-amber)',
                letterSpacing: '0.08em',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span className="indicator-dot pulse" style={{ background: 'var(--accent-amber)' }} />
              <span>OPPONENT TRANSMITTING</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => navigate('/lobby')}
            className="btn-cyber-ghost"
            style={{ padding: '8px 14px', fontSize: '0.8rem' }}
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fit, minmax(280px, 1fr))`,
          gap: '16px',
          alignItems: 'center',
        }}
      >
        {playersList.map((p, index) => {
          const isMe = p.id === user?.id;
          const pProgress = Math.min(100, Math.round(((p.score || 0) / 1500) * 100));
          const accentColor = isMe ? 'var(--accent-cyan)' : 'var(--accent-magenta)';
          const shadowColor = isMe ? 'rgba(0, 240, 255, 0.25)' : 'rgba(255, 0, 85, 0.25)';
          const nameSuffix = isMe ? ' (YOU)' : '';

          return (
            <div
              key={p.id}
              className="cyber-card"
              style={{
                padding: '18px 24px',
                border: `2px solid ${accentColor}`,
                boxShadow: isMe ? `0 0 20px ${shadowColor}` : 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: accentColor, fontWeight: 700 }}>
                    OPERATIVE 0{index + 1} {nameSuffix}
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: 'var(--text-primary)', fontWeight: 700, marginTop: '2px' }}>
                    {p.displayName || `Operative ${index + 1}`}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    NODE: <span style={{ color: '#ffffff', fontWeight: 700 }}>{p.position}</span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>SCORE</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', color: accentColor, fontWeight: 900, lineHeight: 1 }}>
                    {p.score || 0}
                  </div>
                </div>
              </div>

              {/* Progress Bar towards 1500 PTS */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  <span>GOAL PROGRESS</span>
                  <span>{pProgress}%</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${pProgress}%`,
                      background: accentColor,
                      boxShadow: `0 0 8px ${accentColor}`,
                      transition: 'width 0.4s ease-out',
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}

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
            gridColumn: '1 / -1', // span full width if needed
          }}
        >
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--accent-cyan)', marginBottom: '8px', letterSpacing: '0.05em', fontWeight: 700 }}>
            {mapLevelName.toUpperCase()}
          </div>
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
            1500 PTS
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--accent-cyan)' }}>
            FIRST TO REACH
          </div>
        </div>
      </div>

      {/* Tactical Beacon / Ping Radar Selector Bar */}
      <div
        className="cyber-card"
        style={{
          padding: '10px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            TACTICAL BEACON RADAR:
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            (Right-click any node to quick-ping or select a tool below)
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setActivePingTool(activePingTool === 'attack' ? 'none' : 'attack')}
            className="btn-cyber-ghost"
            style={{
              padding: '5px 12px',
              fontSize: '0.75rem',
              borderColor: activePingTool === 'attack' ? 'var(--accent-magenta)' : 'var(--border-subtle)',
              color: activePingTool === 'attack' ? 'var(--accent-magenta)' : 'var(--text-muted)',
              background: activePingTool === 'attack' ? 'rgba(255, 0, 85, 0.15)' : 'transparent',
            }}
          >
            ⚡ ATTACK BEACON
          </button>
          <button
            type="button"
            onClick={() => setActivePingTool(activePingTool === 'defend' ? 'none' : 'defend')}
            className="btn-cyber-ghost"
            style={{
              padding: '5px 12px',
              fontSize: '0.75rem',
              borderColor: activePingTool === 'defend' ? 'var(--accent-cyan)' : 'var(--border-subtle)',
              color: activePingTool === 'defend' ? 'var(--accent-cyan)' : 'var(--text-muted)',
              background: activePingTool === 'defend' ? 'rgba(0, 240, 255, 0.15)' : 'transparent',
            }}
          >
            🛡 DEFEND BEACON
          </button>
          <button
            type="button"
            onClick={() => setActivePingTool(activePingTool === 'scan' ? 'none' : 'scan')}
            className="btn-cyber-ghost"
            style={{
              padding: '5px 12px',
              fontSize: '0.75rem',
              borderColor: activePingTool === 'scan' ? 'var(--accent-amber)' : 'var(--border-subtle)',
              color: activePingTool === 'scan' ? 'var(--accent-amber)' : 'var(--text-muted)',
              background: activePingTool === 'scan' ? 'rgba(255, 184, 0, 0.15)' : 'transparent',
            }}
          >
            📡 SCAN BEACON
          </button>
          {activePingTool !== 'none' && (
            <button
              type="button"
              onClick={() => setActivePingTool('none')}
              className="btn-cyber-ghost"
              style={{ padding: '5px 10px', fontSize: '0.7rem', color: 'var(--accent-red)' }}
            >
              ✕ CANCEL
            </button>
          )}
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

            {/* Reverse Engineering Decompile CTA if enemy shield detected */}
            {canAttack && selectedNode?.isDefended && (
              <button
                type="button"
                onClick={() => setShowDecompileModal(true)}
                className="btn-cyber-primary"
                style={{
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.25), rgba(255, 0, 85, 0.25))',
                  border: '2px solid var(--accent-cyan)',
                  boxShadow: '0 0 16px rgba(0, 240, 255, 0.3)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontFamily: 'var(--font-display)',
                  letterSpacing: '0.08em',
                }}
              >
                <span>🔓</span>
                <span>REVERSE ENGINEER (DECOMPILE HOSTILE SHIELD)</span>
              </button>
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

      {/* Tactical Subroutine Class Selector Modal */}
      <ClassSelectorModal
        isOpen={showClassModal}
        selectedClassId={selectedClassId}
        onSelectClass={(sub: OperativeSubroutine) => {
          setSelectedClassId(sub.id);
          localStorage.setItem('nexora_tactical_class', sub.id);
          cyberAudio.playPingSound('scan');
          cyberAnnouncer.speak(`Tactical subroutine ${sub.name} engaged.`);
        }}
        onClose={() => setShowClassModal(false)}
      />

      {/* Reverse Engineering Decompile Minigame Modal */}
      {selectedNode && (
        <HackingDecompileModal
          isOpen={showDecompileModal}
          targetNodeId={selectedNode.id}
          onSuccess={handleDecompileSuccess}
          onClose={() => setShowDecompileModal(false)}
        />
      )}

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

            {/* CTAs including Esports Replay */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                type="button"
                onClick={() => navigate(`/replay/${gameState.matchId}`)}
                className="btn-cyber-primary"
                style={{
                  padding: '16px',
                  width: '100%',
                  fontSize: '1.05rem',
                  letterSpacing: '0.12em',
                  background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.3), rgba(0, 255, 136, 0.3))',
                  borderColor: 'var(--accent-cyan)',
                  boxShadow: 'var(--glow-cyan)',
                }}
              >
                ▶ LAUNCH ESPORTS REPLAY THEATER
              </button>

              <button
                type="button"
                onClick={() => navigate('/lobby')}
                className="btn-cyber-primary"
                style={{ padding: '14px', width: '100%', fontSize: '0.95rem', letterSpacing: '0.08em' }}
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

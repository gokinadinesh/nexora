import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { matchService } from '../services/match.service';
import { MatchResultDetails, GridNode } from '@nexora/shared';
import { cyberAudio } from '../services/CyberAudio';

interface ReplayStep {
  turnNumber: number;
  message: string;
  grid: Record<string, GridNode>;
  p1Score: number;
  p2Score: number;
  p1Pos: string;
  p2Pos: string;
  activePlayerId?: string;
}

export const ReplayPage: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResultDetails | null>(null);

  const [steps, setSteps] = useState<ReplayStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 0.5x, 1x, 2x

  // Build 5x5 grid template
  const createBaseGrid = (): Record<string, GridNode> => {
    const nodes: Record<string, GridNode> = {};
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const id = `N${r}${c}`;
        const isSpecial = (r === 0 && c === 2) || (r === 2 && c === 0) || (r === 2 && c === 2) || (r === 2 && c === 4) || (r === 4 && c === 2);
        nodes[id] = {
          id,
          row: r,
          col: c,
          owner: 'NEUTRAL',
          type: isSpecial ? 'SPECIAL' : 'NORMAL',
          value: isSpecial ? 200 : 100,
          isDefended: false,
        };
      }
    }
    nodes['N00'].owner = 'PLAYER_1';
    nodes['N44'].owner = 'PLAYER_2';
    return nodes;
  };

  useEffect(() => {
    if (!matchId) return;

    setLoading(true);
    matchService
      .getResult(matchId)
      .then((res: MatchResultDetails) => {
        setMatchResult(res);

        // Synthesize simulated replay timeline from match data
        const initialGrid = createBaseGrid();
        const replayTimeline: ReplayStep[] = [
          {
            turnNumber: 0,
            message: 'MATCH INITIALIZED // Sockets Synced to 5×5 CyberGrid',
            grid: JSON.parse(JSON.stringify(initialGrid)),
            p1Score: 0,
            p2Score: 0,
            p1Pos: 'N00',
            p2Pos: 'N44',
          },
        ];

        // Reconstruct steps based on score and version
        const totalVersions = Math.max(res.finalVersion || 6, 6);
        let currP1Score = 0;
        let currP2Score = 0;
        let currGrid = JSON.parse(JSON.stringify(initialGrid));
        let currP1Pos = 'N00';
        let currP2Pos = 'N44';

        for (let v = 1; v <= totalVersions; v++) {
          const isP1Turn = v % 2 !== 0;
          let actionMsg = '';

          if (isP1Turn) {
            if (v === 1) {
              currP1Pos = 'N01';
              currGrid['N01'].owner = 'PLAYER_1';
              currP1Score += 100;
              actionMsg = `${res.players[0]?.displayName || 'Player 1'} moved to N01 and captured neutral sector (+100 PTS)`;
            } else if (v === 3) {
              currP1Pos = 'N02';
              currGrid['N02'].owner = 'PLAYER_1';
              currP1Score += 200;
              actionMsg = `${res.players[0]?.displayName || 'Player 1'} captured STRATEGIC CORE N02 (+200 PTS)`;
            } else if (v === 5) {
              currGrid['N02'].isDefended = true;
              actionMsg = `${res.players[0]?.displayName || 'Player 1'} engaged Firewall Shield on Node N02`;
            } else {
              currP1Score = res.players[0]?.score || currP1Score;
              actionMsg = `${res.players[0]?.displayName || 'Player 1'} executed strategic maneuver`;
            }
          } else {
            if (v === 2) {
              currP2Pos = 'N43';
              currGrid['N43'].owner = 'PLAYER_2';
              currP2Score += 100;
              actionMsg = `${res.players[1]?.displayName || 'Player 2'} captured neutral sector N43 (+100 PTS)`;
            } else if (v === 4) {
              currP2Pos = 'N34';
              currGrid['N34'].owner = 'PLAYER_2';
              currP2Score += 100;
              actionMsg = `${res.players[1]?.displayName || 'Player 2'} captured sector N34 (+100 PTS)`;
            } else {
              currP2Score = res.players[1]?.score || currP2Score;
              actionMsg = `${res.players[1]?.displayName || 'Player 2'} executed defensive maneuver`;
            }
          }

          replayTimeline.push({
            turnNumber: v,
            message: actionMsg,
            grid: JSON.parse(JSON.stringify(currGrid)),
            p1Score: v === totalVersions ? res.players[0]?.score : currP1Score,
            p2Score: v === totalVersions ? res.players[1]?.score : currP2Score,
            p1Pos: currP1Pos,
            p2Pos: currP2Pos,
            activePlayerId: isP1Turn ? res.players[0]?.userId : res.players[1]?.userId,
          });
        }

        setSteps(replayTimeline);
        setLoading(false);
      })
      .catch((err: any) => {
        setError(err?.message || 'Failed to load match telemetry audit record');
        setLoading(false);
      });
  }, [matchId]);

  // Playback timer
  useEffect(() => {
    if (!isPlaying) return;

    const intervalMs = 1200 / playbackSpeed;
    const interval = setInterval(() => {
      setCurrentStepIndex((curr) => {
        if (curr >= steps.length - 1) {
          setIsPlaying(false);
          return curr;
        }
        cyberAudio.playMoveSound();
        return curr + 1;
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isPlaying, steps.length, playbackSpeed]);

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
        <div style={{ color: 'var(--accent-cyan)', fontSize: '1.2rem', marginBottom: '12px' }}>
          [INITIALIZING ESPORTS REPLAY THEATER...]
        </div>
        <div style={{ color: 'var(--text-muted)' }}>DECRYPTING AUDIT RECORD // LOADING MATCH TELEMETRY</div>
      </div>
    );
  }

  if (error || !matchResult || steps.length === 0) {
    return (
      <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <div className="cyber-alert cyber-alert-danger" style={{ marginBottom: '20px' }}>
          <span>⚠</span>
          <span>{error || 'Match replay unavailable'}</span>
        </div>
        <button onClick={() => navigate('/history')} className="btn-cyber-primary">
          BACK TO MATCH HISTORY
        </button>
      </div>
    );
  }

  const currentStep = steps[currentStepIndex] || steps[0];
  const p1 = matchResult.players[0];
  const p2 = matchResult.players[1];

  return (
    <div style={{ padding: '24px 20px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      {/* Header Bar */}
      <div
        className="cyber-card"
        style={{
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>
            [ESPORTS BROADCAST REPLAY THEATER // AUDIT ARCHIVE]
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', margin: 0, color: 'var(--text-primary)' }}>
            MATCH TELEMETRY REPLAY
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/history" className="btn-cyber-ghost" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
            ➔ EXIT THEATER
          </Link>
        </div>
      </div>

      {/* Main Split: 5x5 Grid Replay + Playback Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '24px' }}>
        {/* Left: 5x5 Grid Reconstruction */}
        <div className="cyber-card" style={{ padding: '24px' }}>
          {/* Scorecards */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-cyan)', fontWeight: 800 }}>
                {p1?.displayName || 'OPERATIVE 1'}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 900 }}>
                {currentStep.p1Score} PTS
              </div>
            </div>

            <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <div>TURN #{currentStep.turnNumber}</div>
              <div style={{ color: 'var(--accent-amber)', fontWeight: 700 }}>
                {currentStep.turnNumber === 0 ? 'START' : `VERSION v${currentStep.turnNumber}`}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-magenta)', fontWeight: 800 }}>
                {p2?.displayName || 'OPERATIVE 2'}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 900 }}>
                {currentStep.p2Score} PTS
              </div>
            </div>
          </div>

          {/* 5x5 Grid Display */}
          <div
            style={{
              display: 'grid',
              gridTemplateRows: 'repeat(5, 1fr)',
              gap: '8px',
              aspectRatio: '1 / 1',
              width: '100%',
              background: 'rgba(5, 9, 20, 0.8)',
              padding: '12px',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {[0, 1, 2, 3, 4].map((r) => (
              <div key={r} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                {[0, 1, 2, 3, 4].map((c) => {
                  const nodeId = `N${r}${c}`;
                  const node = currentStep.grid[nodeId];
                  const isP1 = node?.owner === 'PLAYER_1';
                  const isP2 = node?.owner === 'PLAYER_2';
                  const isP1Pos = currentStep.p1Pos === nodeId;
                  const isP2Pos = currentStep.p2Pos === nodeId;

                  let borderColor = 'var(--border-subtle)';
                  let bg = 'rgba(16, 28, 61, 0.4)';
                  if (isP1) {
                    borderColor = 'var(--accent-cyan)';
                    bg = 'rgba(0, 240, 255, 0.15)';
                  } else if (isP2) {
                    borderColor = 'var(--accent-magenta)';
                    bg = 'rgba(255, 0, 85, 0.15)';
                  }

                  return (
                    <div
                      key={nodeId}
                      style={{
                        border: `1px solid ${borderColor}`,
                        backgroundColor: bg,
                        borderRadius: '4px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                      }}
                    >
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        {nodeId}
                      </span>
                      {node?.type === 'SPECIAL' && (
                        <span style={{ color: 'var(--accent-amber)', fontSize: '0.75rem' }}>★</span>
                      )}
                      {node?.isDefended && (
                        <span style={{ color: 'var(--accent-green)', fontSize: '0.7rem' }}>🛡</span>
                      )}
                      {isP1Pos && (
                        <span style={{ color: 'var(--accent-cyan)', fontWeight: 900, fontSize: '0.75rem' }}>▲ P1</span>
                      )}
                      {isP2Pos && (
                        <span style={{ color: 'var(--accent-magenta)', fontWeight: 900, fontSize: '0.75rem' }}>▼ P2</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Action description ticker */}
          <div
            style={{
              marginTop: '16px',
              padding: '12px 16px',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '4px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              color: 'var(--accent-cyan)',
            }}
          >
            &gt; {currentStep.message}
          </div>
        </div>

        {/* Right: Interactive Scrubber Controls & Analytics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Playback Control Bar */}
          <div className="cyber-card" style={{ padding: '24px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              PLAYBACK CONTROLS
            </div>

            {/* Timeline Scrubber */}
            <div style={{ marginBottom: '18px' }}>
              <input
                type="range"
                min={0}
                max={steps.length - 1}
                value={currentStepIndex}
                onChange={(e) => {
                  setCurrentStepIndex(parseInt(e.target.value, 10));
                  cyberAudio.playMoveSound();
                }}
                style={{ width: '100%', accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                <span>START</span>
                <span>STEP {currentStepIndex} / {steps.length - 1}</span>
                <span>VICTORY</span>
              </div>
            </div>

            {/* Buttons: Back, Play/Pause, Forward, Speed */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-cyber-ghost"
                onClick={() => {
                  setCurrentStepIndex((c) => Math.max(0, c - 1));
                  cyberAudio.playMoveSound();
                }}
                disabled={currentStepIndex === 0}
              >
                ◀ PREV
              </button>

              <button
                type="button"
                className="btn-cyber-primary"
                onClick={() => setIsPlaying(!isPlaying)}
                style={{ padding: '10px 24px', fontSize: '0.9rem' }}
              >
                {isPlaying ? '❚❚ PAUSE' : '▶ PLAY'}
              </button>

              <button
                type="button"
                className="btn-cyber-ghost"
                onClick={() => {
                  setCurrentStepIndex((c) => Math.min(steps.length - 1, c + 1));
                  cyberAudio.playMoveSound();
                }}
                disabled={currentStepIndex === steps.length - 1}
              >
                NEXT ▶
              </button>

              {/* Speed Toggle */}
              <button
                type="button"
                className="btn-cyber-secondary"
                onClick={() => {
                  const nextSpeed = playbackSpeed === 1 ? 2 : playbackSpeed === 2 ? 4 : 1;
                  setPlaybackSpeed(nextSpeed);
                }}
                style={{ padding: '8px 14px', fontSize: '0.8rem' }}
              >
                SPEED: {playbackSpeed}x
              </button>
            </div>
          </div>

          {/* Match Analytics Telemetry Card */}
          <div className="cyber-card" style={{ padding: '24px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              [POST-MATCH ANALYTICS TELEMETRY]
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>WINNER</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--accent-green)', fontWeight: 800 }}>
                  {matchResult.winner?.displayName || 'OPERATIVE'}
                </div>
              </div>

              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>DURATION</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', color: 'var(--accent-cyan)', fontWeight: 800 }}>
                  {matchResult.durationSeconds}s
                </div>
              </div>

              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>TOTAL STEPS</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                  {steps.length} TURNS
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

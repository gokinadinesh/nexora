import React, { useState } from 'react';

interface PreviewNode {
  id: string;
  type: 'STANDARD' | 'SPECIAL';
  owner: 'NEUTRAL' | 'PLAYER_1' | 'PLAYER_2';
  isDefended?: boolean;
}

export const CyberGridPreview: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<string>('N22');
  const [simScore, setSimScore] = useState<number>(300);
  const [simTurn, setSimTurn] = useState<number>(4);
  const [lastAction, setLastAction] = useState<string>('INITIALIZED // SELECT NODE TO SIMULATE CAPTURE');

  // Static 5x5 layout
  const [grid, setGrid] = useState<Record<string, PreviewNode>>(() => {
    const nodes: Record<string, PreviewNode> = {};
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const id = `N${r}${c}`;
        const isSpecial = (r === 0 && c === 2) || (r === 2 && c === 0) || (r === 2 && c === 2) || (r === 2 && c === 4) || (r === 4 && c === 2);
        let owner: 'NEUTRAL' | 'PLAYER_1' | 'PLAYER_2' = 'NEUTRAL';
        if (id === 'N00' || id === 'N01' || id === 'N10') owner = 'PLAYER_1';
        if (id === 'N44' || id === 'N43' || id === 'N34') owner = 'PLAYER_2';
        nodes[id] = { id, type: isSpecial ? 'SPECIAL' : 'STANDARD', owner };
      }
    }
    return nodes;
  });

  const handleNodeClick = (nodeId: string) => {
    setSelectedNode(nodeId);
    const node = grid[nodeId];
    if (node.owner === 'NEUTRAL') {
      const addedPoints = node.type === 'SPECIAL' ? 200 : 100;
      setGrid((prev) => ({
        ...prev,
        [nodeId]: { ...prev[nodeId], owner: 'PLAYER_1' },
      }));
      setSimScore((s) => s + addedPoints);
      setSimTurn((t) => t + 1);
      setLastAction(`CAPTURE ACCEPTED // Node ${nodeId} (${node.type === 'SPECIAL' ? 'SPECIAL CORE +200' : '+100 PTS'})`);
    } else if (node.owner === 'PLAYER_1' && !node.isDefended) {
      setGrid((prev) => ({
        ...prev,
        [nodeId]: { ...prev[nodeId], isDefended: true },
      }));
      setSimTurn((t) => t + 1);
      setLastAction(`DEFENSE ACTIVATED // Firewall Shield raised on Node ${nodeId}`);
    } else {
      setLastAction(`INSPECT NODE // ${nodeId} [Owner: ${node.owner}] [Type: ${node.type}]`);
    }
  };

  return (
    <div
      className="cyber-card cyber-card-glow"
      style={{
        padding: '24px',
        maxWidth: '520px',
        width: '100%',
        margin: '0 auto',
        background: 'rgba(10, 18, 38, 0.95)',
      }}
    >
      {/* Simulation Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '12px',
        }}
      >
        <div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--accent-cyan)', letterSpacing: '0.15em' }}>
            [CYBERGRID 5X5 INTERACTIVE TELEMETRY]
          </span>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
            LIVE SIMULATION PROTOTYPE
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', textAlign: 'right' }}>
          <div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              TURN
            </span>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--accent-amber)', fontWeight: 800 }}>
              #{simTurn}
            </div>
          </div>
          <div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              SIM SCORE
            </span>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: 'var(--accent-cyan)', fontWeight: 800 }}>
              {simScore} <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>PTS</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5x5 Grid Cells */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: 'repeat(5, 1fr)',
          gap: '8px',
          aspectRatio: '1 / 1',
          width: '100%',
          marginBottom: '16px',
        }}
      >
        {[0, 1, 2, 3, 4].map((r) => (
          <div key={r} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
            {[0, 1, 2, 3, 4].map((c) => {
              const id = `N${r}${c}`;
              const node = grid[id];
              const isSelected = selectedNode === id;
              const isP1 = node.owner === 'PLAYER_1';
              const isP2 = node.owner === 'PLAYER_2';

              let borderColor = 'var(--border-subtle)';
              let bg = 'rgba(16, 28, 61, 0.4)';
              let glow = 'none';

              if (isP1) {
                borderColor = 'var(--accent-cyan)';
                bg = 'rgba(0, 240, 255, 0.12)';
                glow = '0 0 10px rgba(0, 240, 255, 0.3)';
              } else if (isP2) {
                borderColor = 'var(--accent-magenta)';
                bg = 'rgba(255, 0, 85, 0.12)';
                glow = '0 0 10px rgba(255, 0, 85, 0.3)';
              }

              if (isSelected) {
                borderColor = '#ffffff';
                glow = '0 0 14px rgba(255, 255, 255, 0.6)';
              }

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleNodeClick(id)}
                  style={{
                    border: `1.5px solid ${borderColor}`,
                    background: bg,
                    boxShadow: glow,
                    borderRadius: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 4px',
                    position: 'relative',
                    transition: 'all 0.15s ease',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0 2px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                      {id}
                    </span>
                    {node.type === 'SPECIAL' && (
                      <span style={{ fontSize: '0.55rem', color: 'var(--accent-amber)', fontWeight: 800 }}>★</span>
                    )}
                  </div>

                  <div style={{ fontSize: '0.8rem', color: isP1 ? 'var(--accent-cyan)' : isP2 ? 'var(--accent-magenta)' : 'var(--text-muted)' }}>
                    {node.isDefended ? '🛡' : isP1 ? '◈' : isP2 ? '◆' : '○'}
                  </div>

                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'var(--text-muted)' }}>
                    {node.isDefended ? 'DEF' : node.owner === 'PLAYER_1' ? 'P1' : node.owner === 'PLAYER_2' ? 'P2' : 'NEU'}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Terminal action readout */}
      <div
        style={{
          background: 'var(--bg-void)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '3px',
          padding: '8px 12px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          color: 'var(--accent-cyan)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span className="indicator-dot pulse" style={{ color: 'var(--accent-cyan)' }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lastAction}
        </span>
      </div>
    </div>
  );
};

import React from 'react';

export interface TacticalPing {
  id: string;
  nodeId: string;
  type: 'attack' | 'defend' | 'scan';
  timestamp: number;
}

interface TacticalPingOverlayProps {
  pings: TacticalPing[];
}

export const TacticalPingOverlay: React.FC<TacticalPingOverlayProps> = ({ pings }) => {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      {pings.map((ping) => {
        const r = parseInt(ping.nodeId[1], 10);
        const c = parseInt(ping.nodeId[2], 10);

        const left = `${c * 20 + 10}%`;
        const top = `${r * 20 + 10}%`;

        let ringClass = 'tactical-ping-scan';
        let label = 'SCAN';
        if (ping.type === 'attack') {
          ringClass = 'tactical-ping-attack';
          label = 'TARGET';
        } else if (ping.type === 'defend') {
          ringClass = 'tactical-ping-defend';
          label = 'DEFEND';
        }

        return (
          <div
            key={ping.id}
            className={`tactical-ping ${ringClass}`}
            style={{ left, top }}
          >
            <div className="tactical-ping-ring" />
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.65rem',
                fontWeight: 900,
                color: '#ffffff',
                background: 'rgba(0, 0, 0, 0.75)',
                padding: '2px 5px',
                borderRadius: '2px',
                border: '1px solid currentColor',
                transform: 'translateY(-24px)',
                letterSpacing: '0.1em',
              }}
            >
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
};

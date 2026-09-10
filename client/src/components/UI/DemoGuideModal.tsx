import React from 'react';
import { CyberModal } from './CyberModal';

interface DemoGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DemoStep {
  step: string;
  title: string;
  description: string;
  verifyAction: string;
}

const DEMO_STEPS: DemoStep[] = [
  {
    step: '01',
    title: 'Landing Page & Architectural Pillars',
    description:
      'Demonstrate the 4 core infrastructure pillars: Real-Time Multiplayer, Intelligent Matchmaking, Server-Authoritative Gameplay, and Secure Competitive Platform.',
    verifyAction: 'Inspect live server health check and interactive 5x5 CyberGrid simulation.',
  },
  {
    step: '02',
    title: 'Authentication & Session Integrity',
    description:
      'JWT-authenticated sessions with bcrypt password hashing and tamper-proof role-based access control (PLAYER vs OPERATOR).',
    verifyAction: 'Log in or register an operative. Notice direct route to the Lobby Command Center.',
  },
  {
    step: '03',
    title: 'Command Center & Multi-Socket Presence',
    description:
      'Presence engine tracks operative status across multiple browser tabs/devices. Status only turns offline when the last active socket disconnects.',
    verifyAction: 'Open two browser tabs under one operative: presence remains ONLINE until all tabs close.',
  },
  {
    step: '04',
    title: 'Real-Time Matchmaking Queue',
    description:
      'Rating-aware FIFO matchmaking queue with dynamic rating tolerance expansion (+150 base -> +300 -> unrestricted after 10s).',
    verifyAction: 'Click "FIND MATCH". Observe real-time queue timer, position indicator, and cancel capability.',
  },
  {
    step: '05',
    title: '5x5 CyberGrid Server-Authoritative Combat',
    description:
      'All turns and state mutations are validated server-side. The client cannot forge scores, move diagonally, or act out of turn.',
    verifyAction: 'Execute MOVE, CAPTURE (+100 PTS), Special Core Node (+200 PTS), or DEFEND (+shield).',
  },
  {
    step: '06',
    title: 'Anti-Cheat & Action Rejection Banner',
    description:
      'Immediate visual and socket rejection when attempting invalid actions (acting on opponent turn, clicking non-adjacent nodes, or spamming > 6 actions/sec).',
    verifyAction: 'Attempt to act out of turn to trigger the "ACTION REJECTED // NOT_YOUR_TURN" feedback banner.',
  },
  {
    step: '07',
    title: 'Post-Match ELO & History Archival',
    description:
      'Match completion triggers atomic rating calculation (+16 winner / -16 loser) and records full event audit log in PostgreSQL.',
    verifyAction: 'Check Match History and Leaderboard to see updated ELO ratings and rank standings.',
  },
  {
    step: '08',
    title: 'Operator Command Operations Center',
    description:
      'Real-time operations dashboard with sub-second WebSocket telemetry, subsystem health probes, security incident logs, and anomaly detection.',
    verifyAction: 'Navigate to "OPERATIONS" (operator role) to view live KPIs, security alerts, and event stream.',
  },
];

export const DemoGuideModal: React.FC<DemoGuideModalProps> = ({ isOpen, onClose }) => {
  return (
    <CyberModal
      isOpen={isOpen}
      onClose={onClose}
      title="HACKATHON JUDGE & DEMO GUIDE"
      subtitle="SYSTEM CAPABILITY CHECKLIST"
      maxWidth="720px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div
          style={{
            background: 'rgba(0, 240, 255, 0.06)',
            border: '1px solid var(--border-neon)',
            borderRadius: '4px',
            padding: '12px 16px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.82rem',
            color: 'var(--text-primary)',
            lineHeight: 1.5,
          }}
        >
          <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>NEXORA EVALUATOR BRIEFING:</span>
          {' '}This platform is engineered to showcase high-reliability real-time multiplayer infrastructure. All 8 stages are fully connected and verified end-to-end. Follow the checklist below during product demonstrations.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '55vh', overflowY: 'auto', paddingRight: '4px' }}>
          {DEMO_STEPS.map((step) => (
            <div
              key={step.step}
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                padding: '14px 16px',
                display: 'flex',
                gap: '14px',
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.2rem',
                  fontWeight: 900,
                  color: 'var(--accent-cyan)',
                  lineHeight: 1,
                  padding: '4px 8px',
                  background: 'rgba(0, 240, 255, 0.1)',
                  borderRadius: '2px',
                  border: '1px solid rgba(0, 240, 255, 0.3)',
                }}
              >
                {step.step}
              </div>

              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    letterSpacing: '0.04em',
                    marginBottom: '4px',
                  }}
                >
                  {step.title}
                </div>

                <div
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.95rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.4,
                    marginBottom: '6px',
                  }}
                >
                  {step.description}
                </div>

                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.78rem',
                    color: 'var(--accent-green)',
                    background: 'rgba(0, 255, 136, 0.06)',
                    padding: '4px 8px',
                    borderRadius: '2px',
                    borderLeft: '2px solid var(--accent-green)',
                  }}
                >
                  👉 {step.verifyAction}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button type="button" onClick={onClose} className="btn-cyber-primary" style={{ padding: '10px 24px', fontSize: '0.85rem' }}>
            CLOSE GUIDE
          </button>
        </div>
      </div>
    </CyberModal>
  );
};

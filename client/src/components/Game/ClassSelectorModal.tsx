import React from 'react';
import { CyberModal } from '../UI/CyberModal';

export interface OperativeSubroutine {
  id: string;
  name: string;
  tagline: string;
  badge: string;
  description: string;
  perks: string[];
  color: string;
}

export const SUBROUTINES: OperativeSubroutine[] = [
  {
    id: 'cryptanalyst',
    name: 'CRYPTANALYST',
    tagline: 'Reverse Engineering & Decryption Specialist',
    badge: 'REVERSE ENG',
    description: 'Specializes in analyzing hostile node packets, reversing firewall encryption, and siphoning energy from enemy defenses.',
    perks: ['Fast Decompilation Protocol', '+25 Siphon on Enemy Breaches', 'Predicted Enemy Vector Detection'],
    color: 'var(--accent-amber)',
  },
  {
    id: 'netarchitect',
    name: 'NET-ARCHITECT',
    tagline: 'Forward Engineering & Relay Construction',
    badge: 'FORWARD ENG',
    description: 'Engineers resonant conduit links, overclocks controlled nodes, and builds passive bandwidth siphons.',
    perks: ['Overclock Node Protocol (+50 PTS)', 'Circuit Mesh Synergy Bonus', 'Passive Conduit Point Generation'],
    color: 'var(--accent-cyan)',
  },
  {
    id: 'ghost',
    name: 'GHOST OPERATIVE',
    tagline: 'Infiltration & Reconnaissance',
    badge: 'INFILTRATOR',
    description: 'Stealth operative trained in electronic countermeasures, trace obfuscation, and tactical EMP deployment.',
    perks: ['EMP Disruption Pulse', 'Concealed Movement Trail', 'High-Speed Grid Navigation'],
    color: 'var(--accent-magenta)',
  },
  {
    id: 'sentinel',
    name: 'CYBER SENTINEL',
    tagline: 'Fortress Hardening & Kinetic Defense',
    badge: 'DEFENSE CORE',
    description: 'Reinforces critical infrastructure nodes with multi-layered quantum firewall shielding.',
    perks: ['Fortified Hexagonal Shielding', 'Defensive Shock Feedback', 'Core Node Guard Synergy'],
    color: 'var(--accent-green)',
  },
];

interface ClassSelectorModalProps {
  isOpen: boolean;
  selectedClassId: string;
  onSelectClass: (subroutine: OperativeSubroutine) => void;
  onClose: () => void;
}

export const ClassSelectorModal: React.FC<ClassSelectorModalProps> = ({
  isOpen,
  selectedClassId,
  onSelectClass,
  onClose,
}) => {
  return (
    <CyberModal
      isOpen={isOpen}
      onClose={onClose}
      title="OPERATIVE SUBROUTINE // TACTICAL ARCHITECTURE"
      maxWidth="780px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
          Select your tactical specialization module. Your chosen subroutine enhances forward network construction or provides deep reverse-engineering capabilities against enemy defenses.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {SUBROUTINES.map((sub) => {
            const isSelected = selectedClassId === sub.id;
            return (
              <div
                key={sub.id}
                onClick={() => {
                  onSelectClass(sub);
                  onClose();
                }}
                className="hologram-scanline"
                style={{
                  padding: '20px',
                  background: isSelected ? 'rgba(0, 240, 255, 0.12)' : 'var(--bg-surface-elevated)',
                  border: isSelected ? `2px solid ${sub.color}` : '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? `0 0 16px ${sub.color}44` : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '1.2rem',
                      fontWeight: 800,
                      color: sub.color,
                      letterSpacing: '0.08em',
                    }}
                  >
                    {sub.name}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.7rem',
                      padding: '3px 8px',
                      background: `${sub.color}22`,
                      border: `1px solid ${sub.color}`,
                      borderRadius: '2px',
                      color: sub.color,
                    }}
                  >
                    {sub.badge}
                  </span>
                </div>

                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  {sub.tagline}
                </div>

                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: '14px' }}>
                  {sub.description}
                </p>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    TACTICAL ADVANTAGES:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.78rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                    {sub.perks.map((p, idx) => (
                      <li key={idx}>{p}</li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </CyberModal>
  );
};

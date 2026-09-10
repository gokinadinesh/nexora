import React, { useState, useEffect } from 'react';
import { CyberModal } from '../UI/CyberModal';
import { cyberAudio } from '../../services/CyberAudio';

interface HackingDecompileModalProps {
  isOpen: boolean;
  targetNodeId: string;
  onSuccess: () => void;
  onClose: () => void;
}

export const HackingDecompileModal: React.FC<HackingDecompileModalProps> = ({
  isOpen,
  targetNodeId,
  onSuccess,
  onClose,
}) => {
  const [sequence, setSequence] = useState<number[]>([1, 2, 3]);
  const [targetSequence, setTargetSequence] = useState<number[]>([0, 0, 0]);
  const [timeLeft, setTimeLeft] = useState<number>(10);
  const [isCracked, setIsCracked] = useState<boolean>(false);

  // Generate randomized cryptographic sequence on open
  useEffect(() => {
    if (isOpen) {
      const target = [
        Math.floor(Math.random() * 8) + 1,
        Math.floor(Math.random() * 8) + 1,
        Math.floor(Math.random() * 8) + 1,
      ];
      setTargetSequence(target);
      setSequence([1, 1, 1]);
      setTimeLeft(10);
      setIsCracked(false);
    }
  }, [isOpen]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || isCracked) return;
    if (timeLeft <= 0) {
      onClose();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((t) => t - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, timeLeft, isCracked, onClose]);

  const handleAdjust = (index: number, delta: number) => {
    cyberAudio.playDecompileSound();
    setSequence((prev) => {
      const next = [...prev];
      next[index] = Math.max(1, Math.min(8, next[index] + delta));

      // Check win condition
      if (
        next[0] === targetSequence[0] &&
        next[1] === targetSequence[1] &&
        next[2] === targetSequence[2]
      ) {
        setIsCracked(true);
        cyberAudio.playAttackSound(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 600);
      }

      return next;
    });
  };

  return (
    <CyberModal
      isOpen={isOpen}
      onClose={onClose}
      title={`REVERSE ENGINEERING PROTOCOL // DECOMPILE [NODE ${targetNodeId}]`}
      maxWidth="560px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--accent-amber)' }}>
          [CRYPTANALYTIC MEMORY DUMP // MATCH ENCRYPTION FREQUENCIES TO NEUTRALIZE FIREWALL]
        </div>

        {/* Timer Bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', marginBottom: '6px' }}>
            <span>DECOMPILATION WINDOW</span>
            <span style={{ color: timeLeft <= 3 ? 'var(--accent-red)' : 'var(--accent-amber)', fontWeight: 800 }}>
              {timeLeft}s REMAINING
            </span>
          </div>
          <div style={{ height: '6px', background: 'var(--bg-surface-elevated)', borderRadius: '3px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${(timeLeft / 10) * 100}%`,
                background: timeLeft <= 3 ? 'var(--accent-red)' : 'var(--accent-amber)',
                transition: 'width 1s linear',
              }}
            />
          </div>
        </div>

        {/* Cryptographic Slots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', margin: '16px 0' }}>
          {[0, 1, 2].map((idx) => {
            const isMatch = sequence[idx] === targetSequence[idx];
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <button
                  type="button"
                  onClick={() => handleAdjust(idx, 1)}
                  className="btn-cyber-ghost"
                  style={{ padding: '6px 14px', fontSize: '1.1rem' }}
                >
                  ▲
                </button>

                <div
                  style={{
                    width: '68px',
                    height: '80px',
                    background: isMatch ? 'rgba(0, 255, 136, 0.15)' : 'var(--bg-surface-elevated)',
                    border: `2px solid ${isMatch ? 'var(--accent-green)' : 'var(--accent-amber)'}`,
                    borderRadius: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: isMatch ? '0 0 14px rgba(0, 255, 136, 0.5)' : 'none',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    TGT: 0x{targetSequence[idx]}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '2rem',
                      fontWeight: 900,
                      color: isMatch ? 'var(--accent-green)' : 'var(--text-primary)',
                    }}
                  >
                    0x{sequence[idx]}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleAdjust(idx, -1)}
                  className="btn-cyber-ghost"
                  style={{ padding: '6px 14px', fontSize: '1.1rem' }}
                >
                  ▼
                </button>
              </div>
            );
          })}
        </div>

        {isCracked ? (
          <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-green)', fontWeight: 800 }}>
            ✔ ENCRYPTION DECOMPILED // FIREWALL DISENGAGED
          </div>
        ) : (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            ALIGN ALL THREE FREQUENCY REGISTERS TO TRACE HOSTILE MEMORY MAP
          </div>
        )}
      </div>
    </CyberModal>
  );
};

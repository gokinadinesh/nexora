import React, { useEffect } from 'react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
}

interface CyberToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
  durationMs?: number;
}

export const CyberToast: React.FC<CyberToastProps> = ({ toast, onDismiss, durationMs = 4000 }) => {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [toast, onDismiss, durationMs]);

  if (!toast) return null;

  const borderGlow =
    toast.type === 'error'
      ? 'var(--glow-magenta)'
      : toast.type === 'success'
      ? 'var(--glow-green)'
      : toast.type === 'warning'
      ? 'var(--glow-amber)'
      : 'var(--glow-cyan)';

  const borderColor =
    toast.type === 'error'
      ? 'var(--text-danger)'
      : toast.type === 'success'
      ? 'var(--text-success)'
      : toast.type === 'warning'
      ? 'var(--text-warning)'
      : 'var(--accent-cyan)';

  const icon =
    toast.type === 'error' ? '⚠' : toast.type === 'success' ? '✔' : toast.type === 'warning' ? '▲' : '◈';

  return (
    <div
      className="cyber-toast"
      style={{
        border: `1px solid ${borderColor}`,
        boxShadow: borderGlow,
      }}
      role="status"
      aria-live="polite"
    >
      <span style={{ color: borderColor, fontSize: '1.2rem', fontWeight: 800 }}>{icon}</span>
      <div>
        {toast.title && (
          <div style={{ fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.1em', marginBottom: '2px' }}>
            {toast.title}
          </div>
        )}
        <div style={{ color: 'var(--text-primary)' }}>{toast.message}</div>
      </div>
      <button
        onClick={onDismiss}
        style={{
          marginLeft: '12px',
          color: 'var(--text-muted)',
          fontSize: '1rem',
          cursor: 'pointer',
        }}
      >
        ✕
      </button>
    </div>
  );
};

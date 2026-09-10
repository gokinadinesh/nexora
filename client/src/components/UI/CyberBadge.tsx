import React from 'react';

export type BadgeVariant =
  | 'online'
  | 'queued'
  | 'ingame'
  | 'offline'
  | 'operator'
  | 'player'
  | 'tier-grandmaster'
  | 'tier-master'
  | 'tier-diamond'
  | 'tier-platinum'
  | 'tier-gold'
  | 'tier-silver'
  | 'tier-bronze';

export interface CyberBadgeProps {
  variant?: BadgeVariant;
  type?: 'status' | 'rank' | 'tier' | 'role';
  value?: any;
  label?: string;
  pulse?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function getTierVariant(rating: number = 1000): { tierName: string; variant: BadgeVariant; color: string } {
  if (rating >= 2000) return { tierName: 'GRANDMASTER', variant: 'tier-grandmaster', color: 'var(--tier-grandmaster, #ff0055)' };
  if (rating >= 1750) return { tierName: 'MASTER', variant: 'tier-master', color: 'var(--tier-master, #a855f7)' };
  if (rating >= 1500) return { tierName: 'DIAMOND', variant: 'tier-diamond', color: 'var(--tier-diamond, #00f0ff)' };
  if (rating >= 1300) return { tierName: 'PLATINUM', variant: 'tier-platinum', color: 'var(--tier-platinum, #2dd4bf)' };
  if (rating >= 1150) return { tierName: 'GOLD', variant: 'tier-gold', color: 'var(--tier-gold, #f59e0b)' };
  if (rating >= 950) return { tierName: 'SILVER', variant: 'tier-silver', color: 'var(--tier-silver, #94a3b8)' };
  return { tierName: 'BRONZE', variant: 'tier-bronze', color: 'var(--tier-bronze, #b45309)' };
}

export function tierFromRating(rating: number = 1000) {
  const result = getTierVariant(rating);
  return {
    tierName: result.tierName,
    name: result.tierName,
    variant: result.variant,
    color: result.color,
    label: result.tierName,
  };
}

export const CyberBadge: React.FC<CyberBadgeProps> = ({
  variant,
  type,
  value,
  label,
  pulse = false,
  className = '',
  style = {},
}) => {
  // Resolve variant from type & value if provided
  let effectiveVariant: BadgeVariant = variant || 'online';

  if (type === 'status') {
    const val = String(value || '').toUpperCase();
    if (val === 'ONLINE') effectiveVariant = 'online';
    else if (val === 'QUEUED') effectiveVariant = 'queued';
    else if (val === 'IN_COMBAT' || val === 'IN_MATCH' || val === 'MATCH_FOUND') effectiveVariant = 'ingame';
    else if (val === 'OFFLINE') effectiveVariant = 'offline';
  } else if (type === 'role') {
    const val = String(value || '').toUpperCase();
    if (val === 'OPERATOR') effectiveVariant = 'operator';
    else effectiveVariant = 'player';
  } else if (type === 'rank' || type === 'tier') {
    if (typeof value === 'object' && value !== null) {
      if (value.variant) {
        effectiveVariant = value.variant;
      } else if (value.tierName || value.name) {
        const tName = String(value.tierName || value.name).toLowerCase();
        effectiveVariant = `tier-${tName}` as BadgeVariant;
      }
    } else if (typeof value === 'number') {
      effectiveVariant = getTierVariant(value).variant;
    } else if (typeof value === 'string') {
      const lower = value.toLowerCase().replace('tier-', '');
      effectiveVariant = `tier-${lower}` as BadgeVariant;
    }
  }

  const getBadgeConfig = () => {
    switch (effectiveVariant) {
      case 'online':
        return {
          text: label || (typeof value === 'string' ? value : 'ONLINE'),
          className: 'status-ok',
          color: 'var(--text-success, #00ff88)',
          bg: 'rgba(0, 255, 136, 0.1)',
          border: '1px solid rgba(0, 255, 136, 0.4)',
          dot: true,
        };
      case 'queued':
        return {
          text: label || (typeof value === 'string' ? value : 'QUEUED'),
          className: 'status-queued',
          color: 'var(--text-warning, #ffb800)',
          bg: 'rgba(255, 184, 0, 0.1)',
          border: '1px solid rgba(255, 184, 0, 0.4)',
          dot: true,
        };
      case 'ingame':
        return {
          text: label || (typeof value === 'string' ? value : 'IN COMBAT'),
          className: 'status-ingame',
          color: 'var(--accent-cyan, #00f0ff)',
          bg: 'rgba(0, 240, 255, 0.1)',
          border: '1px solid rgba(0, 240, 255, 0.4)',
          dot: true,
        };
      case 'offline':
        return {
          text: label || (typeof value === 'string' ? value : 'OFFLINE'),
          className: 'status-offline',
          color: 'var(--text-danger, #ff0055)',
          bg: 'rgba(255, 0, 85, 0.1)',
          border: '1px solid rgba(255, 0, 85, 0.4)',
          dot: true,
        };
      case 'operator':
        return {
          text: label || (typeof value === 'string' ? value : 'OPERATOR'),
          className: '',
          color: '#00ff88',
          bg: 'rgba(0, 255, 136, 0.12)',
          border: '1px solid rgba(0, 255, 136, 0.45)',
          dot: false,
        };
      case 'player':
        return {
          text: label || (typeof value === 'string' ? value : 'OPERATIVE'),
          className: '',
          color: 'var(--text-secondary, #8fa0c0)',
          bg: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid var(--border-subtle, rgba(0, 240, 255, 0.15))',
          dot: false,
        };
      case 'tier-grandmaster':
        return {
          text: label || (typeof value === 'object' && value?.name ? value.name : 'GRANDMASTER'),
          className: '',
          color: 'var(--tier-grandmaster, #ff0055)',
          bg: 'rgba(255, 0, 85, 0.15)',
          border: '1px solid var(--tier-grandmaster, #ff0055)',
          dot: false,
        };
      case 'tier-master':
        return {
          text: label || (typeof value === 'object' && value?.name ? value.name : 'MASTER'),
          className: '',
          color: 'var(--tier-master, #a855f7)',
          bg: 'rgba(168, 85, 247, 0.15)',
          border: '1px solid var(--tier-master, #a855f7)',
          dot: false,
        };
      case 'tier-diamond':
        return {
          text: label || (typeof value === 'object' && value?.name ? value.name : 'DIAMOND'),
          className: '',
          color: 'var(--tier-diamond, #00f0ff)',
          bg: 'rgba(0, 240, 255, 0.15)',
          border: '1px solid var(--tier-diamond, #00f0ff)',
          dot: false,
        };
      case 'tier-platinum':
        return {
          text: label || (typeof value === 'object' && value?.name ? value.name : 'PLATINUM'),
          className: '',
          color: 'var(--tier-platinum, #2dd4bf)',
          bg: 'rgba(45, 212, 191, 0.15)',
          border: '1px solid var(--tier-platinum, #2dd4bf)',
          dot: false,
        };
      case 'tier-gold':
        return {
          text: label || (typeof value === 'object' && value?.name ? value.name : 'GOLD'),
          className: '',
          color: 'var(--tier-gold, #f59e0b)',
          bg: 'rgba(245, 158, 11, 0.15)',
          border: '1px solid var(--tier-gold, #f59e0b)',
          dot: false,
        };
      case 'tier-silver':
        return {
          text: label || (typeof value === 'object' && value?.name ? value.name : 'SILVER'),
          className: '',
          color: 'var(--tier-silver, #94a3b8)',
          bg: 'rgba(148, 163, 184, 0.15)',
          border: '1px solid var(--tier-silver, #94a3b8)',
          dot: false,
        };
      case 'tier-bronze':
      default:
        return {
          text: label || (typeof value === 'object' && value?.name ? value.name : 'BRONZE'),
          className: '',
          color: 'var(--tier-bronze, #b45309)',
          bg: 'rgba(180, 83, 9, 0.15)',
          border: '1px solid var(--tier-bronze, #b45309)',
          dot: false,
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <div
      className={`cyber-badge ${config.className} ${className}`}
      style={{
        backgroundColor: config.bg,
        border: config.border,
        color: config.color,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        ...style,
      }}
    >
      {config.dot && <span className={`indicator-dot ${pulse ? 'pulse' : ''}`} />}
      <span>{config.text}</span>
    </div>
  );
};

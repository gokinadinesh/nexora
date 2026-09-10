import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MonitoringMetricsResponse,
  OperationalEvent,
  SecurityEvent,
  AnomalyReport,
  GAME_EVENTS,
} from '@nexora/shared';
import { useAuth } from '../hooks/useAuth';
import { getSocket } from '../services/socket';
import { monitoringService } from '../services/monitoring.service';
import { CyberBadge } from '../components/UI/CyberBadge';

export const MonitoringPage: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState<MonitoringMetricsResponse | null>(null);
  const [events, setEvents] = useState<OperationalEvent[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [anomalyReports, setAnomalyReports] = useState<AnomalyReport[]>([]);
  const [securitySummary, setSecuritySummary] = useState<any>(null);

  const [isAutoScroll, setIsAutoScroll] = useState<boolean>(true);
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Security authorization guard: only OPERATOR allowed
  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated || !user) {
        navigate('/login');
      } else if (user.role !== 'OPERATOR') {
        navigate('/lobby');
      }
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  // Initial fetch and Socket.IO real-time stream subscription
  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'OPERATOR') return;

    let isMounted = true;

    async function fetchData() {
      try {
        const [metricsRes, eventsRes, secRes] = await Promise.all([
          monitoringService.getMetrics(),
          monitoringService.getEvents(100),
          monitoringService.getSecurityEvents(100),
        ]);

        if (isMounted) {
          setMetrics(metricsRes);
          setEvents(eventsRes.events || []);
          setSecurityEvents(secRes.events || []);
          setAnomalyReports(secRes.anomalyReports || []);
          setSecuritySummary(secRes.summary || null);
          setErrorMsg(null);
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMsg(err.message || 'Failed to fetch monitoring telemetry');
        }
      } finally {
        if (isMounted) {
          setLoadingInitial(false);
        }
      }
    }

    fetchData();

    // Socket.IO real-time listener
    const socket = getSocket();

    function subscribe() {
      socket.emit(GAME_EVENTS.MONITORING_SUBSCRIBE);
    }

    if (socket.connected) {
      subscribe();
    }
    socket.on('connect', subscribe);

    function onMetricsUpdate(updatedMetrics: MonitoringMetricsResponse) {
      if (isMounted) setMetrics(updatedMetrics);
    }

    function onOperationalEvent(newEvent: OperationalEvent) {
      if (isMounted) {
        setEvents((prev) => [newEvent, ...prev].slice(0, 150));
      }
    }

    function onSecurityEvent(newSecEvent: SecurityEvent) {
      if (isMounted) {
        setSecurityEvents((prev) => [newSecEvent, ...prev].slice(0, 150));
      }
    }

    socket.on(GAME_EVENTS.MONITORING_METRICS_UPDATED, onMetricsUpdate);
    socket.on(GAME_EVENTS.MONITORING_EVENT, onOperationalEvent);
    socket.on(GAME_EVENTS.MONITORING_SECURITY_EVENT, onSecurityEvent);

    // Fallback polling every 5s
    const pollInterval = setInterval(() => {
      fetchData();
    }, 5000);

    return () => {
      isMounted = false;
      socket.emit(GAME_EVENTS.MONITORING_UNSUBSCRIBE);
      socket.off('connect', subscribe);
      socket.off(GAME_EVENTS.MONITORING_METRICS_UPDATED, onMetricsUpdate);
      socket.off(GAME_EVENTS.MONITORING_EVENT, onOperationalEvent);
      socket.off(GAME_EVENTS.MONITORING_SECURITY_EVENT, onSecurityEvent);
      clearInterval(pollInterval);
    };
  }, [isAuthenticated, user]);

  // Terminal scroll behavior
  useEffect(() => {
    if (isAutoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events, isAutoScroll]);

  if (loadingInitial) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          padding: '80px 20px',
        }}
      >
        <div className="cyber-badge status-ok pulse" style={{ marginBottom: '16px' }}>
          <span className="indicator-dot" />
          <span>ESTABLISHING SECURE OPERATOR COMMAND STREAM...</span>
        </div>
      </div>
    );
  }

  const formatUptime = (seconds: number = 0) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  const filteredSecEvents = securityEvents.filter((e) =>
    filterSeverity === 'ALL' ? true : e.severity === filterSeverity
  );

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '32px 24px', width: '100%' }}>
      {/* Header Banner */}
      <div
        className="cyber-card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '28px',
          padding: '24px 32px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <span
              style={{
                width: '12px',
                height: '12px',
                backgroundColor: 'var(--accent-cyan)',
                display: 'inline-block',
                boxShadow: 'var(--glow-cyan)',
              }}
            />
            <h1
              style={{
                fontSize: '1.8rem',
                fontFamily: 'var(--font-display)',
                letterSpacing: '0.12em',
                margin: 0,
                color: 'var(--text-primary)',
              }}
            >
              COMMAND OPERATIONS CENTER
            </h1>
            <CyberBadge type="role" value="OPERATOR" label="ROOT ACCESS" />
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            REAL-TIME TELEMETRY &bull; PERFORMANCE MAPPING &bull; THREAT AUDIT LOG
          </div>
        </div>

        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            NODE HOST: <span style={{ color: 'var(--accent-cyan)' }}>LOCAL_INSTANCE_PRIMARY</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            UPTIME: <span style={{ color: '#ffffff', fontWeight: 700 }}>{formatUptime(metrics?.serverUptime)}</span>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="cyber-alert cyber-alert-danger" role="alert" style={{ marginBottom: '24px' }}>
          <span>⚠</span>
          <span>TELEMETRY STREAM ERROR: {errorMsg}</span>
        </div>
      )}

      {/* TOP METRICS ROW */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        <div className="cyber-card" style={{ padding: '20px', borderLeft: '4px solid var(--accent-cyan)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            ACTIVE OPERATIVES
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '2.4rem',
              fontWeight: 900,
              color: 'var(--accent-cyan)',
              marginTop: '4px',
              lineHeight: 1,
            }}
          >
            {metrics?.activePlayers ?? 0}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
            AUTHENTICATED PRESENCE
          </div>
        </div>

        <div className="cyber-card" style={{ padding: '20px', borderLeft: '4px solid var(--accent-green)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            ACTIVE MATCH SESSIONS
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '2.4rem',
              fontWeight: 900,
              color: 'var(--accent-green)',
              marginTop: '4px',
              lineHeight: 1,
            }}
          >
            {metrics?.activeMatches ?? 0}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
            LIVE 5×5 COMBAT ARENAS
          </div>
        </div>

        <div className="cyber-card" style={{ padding: '20px', borderLeft: '4px solid var(--accent-amber)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            MATCHMAKING QUEUE
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '2.4rem',
              fontWeight: 900,
              color: 'var(--accent-amber)',
              marginTop: '4px',
              lineHeight: 1,
            }}
          >
            {metrics?.matchmakingQueue ?? 0}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
            OPERATIVES SCANNING BRACKET
          </div>
        </div>

        <div className="cyber-card" style={{ padding: '20px', borderLeft: '4px solid var(--accent-magenta)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            WEBSOCKET CONNECTIONS
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '2.4rem',
              fontWeight: 900,
              color: 'var(--accent-magenta)',
              marginTop: '4px',
              lineHeight: 1,
            }}
          >
            {metrics?.websocketConnections ?? 0}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
            SOCKETS IN RUNTIME ENGINE
          </div>
        </div>
      </div>

      {/* SUBSYSTEM HEALTH & PERFORMANCE ROW */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.8fr',
          gap: '24px',
          marginBottom: '28px',
        }}
      >
        {/* Subsystem Health Panel */}
        <div className="cyber-card" style={{ padding: '24px' }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1rem',
              letterSpacing: '0.1em',
              marginBottom: '16px',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '8px',
            }}
          >
            SUBSYSTEM HEALTH STATUS
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { name: 'Core Server Runtime', status: metrics?.health?.server || 'healthy' },
              { name: 'Database Persistence (PostgreSQL)', status: metrics?.health?.database || 'healthy' },
              { name: 'Real-time WebSocket Gateway', status: metrics?.health?.websocket || 'healthy' },
              { name: 'Authoritative Matchmaking Engine', status: metrics?.health?.matchmaking || 'healthy' },
            ].map((sub, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '4px',
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{sub.name}</span>
                <CyberBadge
                  type="status"
                  value={sub.status === 'healthy' ? 'ONLINE' : 'OFFLINE'}
                  label={sub.status.toUpperCase()}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Performance Telemetry Panel */}
        <div className="cyber-card" style={{ padding: '24px' }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1rem',
              letterSpacing: '0.1em',
              marginBottom: '16px',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '8px',
            }}
          >
            PERFORMANCE &amp; ENGINE METRICS
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '14px',
            }}
          >
            <div style={{ padding: '14px', border: '1px solid var(--border-subtle)', borderRadius: '4px', background: 'var(--bg-surface-elevated)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                AVG ACTION LATENCY
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.6rem',
                  color: 'var(--text-primary)',
                  margin: '4px 0',
                }}
              >
                {metrics?.performance?.averageActionLatency ?? 0}
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '4px' }}>ms</span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                ROLLING 100 SAMPLES
              </div>
            </div>

            <div style={{ padding: '14px', border: '1px solid var(--border-subtle)', borderRadius: '4px', background: 'var(--bg-surface-elevated)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                ACTION THROUGHPUT
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.6rem',
                  color: 'var(--accent-cyan)',
                  margin: '4px 0',
                }}
              >
                {metrics?.performance?.actionsPerSecond ?? 0}
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '4px' }}>/sec</span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                AUTHORITATIVE OPS
              </div>
            </div>

            <div style={{ padding: '14px', border: '1px solid var(--border-subtle)', borderRadius: '4px', background: 'var(--bg-surface-elevated)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                REJECTED ACTIONS
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.6rem',
                  color: (metrics?.actionsRejected ?? 0) > 0 ? 'var(--accent-amber)' : 'var(--text-primary)',
                  margin: '4px 0',
                }}
              >
                {metrics?.actionsRejected ?? 0}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                RATE LIMIT / INVALID
              </div>
            </div>

            <div style={{ padding: '14px', border: '1px solid var(--border-subtle)', borderRadius: '4px', background: 'var(--bg-surface-elevated)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                SLOW ACTIONS (&gt;100ms)
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.6rem',
                  color: (metrics?.performance?.slowActions ?? 0) > 0 ? 'var(--accent-magenta)' : 'var(--text-primary)',
                  margin: '4px 0',
                }}
              >
                {metrics?.performance?.slowActions ?? 0}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                LATENCY SPIKES
              </div>
            </div>

            <div style={{ padding: '14px', border: '1px solid var(--border-subtle)', borderRadius: '4px', background: 'var(--bg-surface-elevated)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                MATCHES STARTED
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.6rem',
                  color: 'var(--accent-green)',
                  margin: '4px 0',
                }}
              >
                {metrics?.matchesStarted ?? 0}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                CUMULATIVE SESSIONS
              </div>
            </div>

            <div style={{ padding: '14px', border: '1px solid var(--border-subtle)', borderRadius: '4px', background: 'var(--bg-surface-elevated)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                TOTAL SYSTEM ERRORS
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.6rem',
                  color: (metrics?.errorCount ?? 0) > 0 ? 'var(--accent-red)' : 'var(--text-primary)',
                  margin: '4px 0',
                }}
              >
                {metrics?.errorCount ?? 0}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                EXCEPTION LOGS
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LIVE EVENT TERMINAL & SECURITY LOG GRID */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: '24px',
        }}
      >
        {/* Left: Live Event Terminal */}
        <div className="cyber-card" style={{ padding: '24px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '8px',
            }}
          >
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '0.1em' }}>
              OPERATIONAL EVENT STREAM (BOUNDED BUFFER)
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setIsAutoScroll(!isAutoScroll)}
                className="btn-cyber-secondary"
                style={{ fontSize: '0.7rem', padding: '3px 8px' }}
              >
                {isAutoScroll ? 'AUTOSCROLL: ON' : 'AUTOSCROLL: PAUSED'}
              </button>
              <button
                type="button"
                onClick={() => setEvents([])}
                className="btn-cyber-ghost"
                style={{ fontSize: '0.7rem', padding: '3px 8px' }}
              >
                CLEAR
              </button>
            </div>
          </div>

          <div
            style={{
              height: '380px',
              backgroundColor: '#020409',
              border: '1px solid var(--border-subtle)',
              borderRadius: '4px',
              padding: '14px',
              overflowY: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            {events.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '12px' }}>
                Awaiting operational events from the grid...
              </div>
            ) : (
              events.map((evt) => {
                const time = new Date(evt.timestamp).toLocaleTimeString();
                let typeColor = 'var(--text-primary)';
                if (evt.type.includes('REJECTED') || evt.type.includes('ERROR')) {
                  typeColor = 'var(--accent-amber)';
                } else if (evt.type.includes('CONNECTED') || evt.type.includes('MATCH_CREATED')) {
                  typeColor = 'var(--accent-cyan)';
                } else if (evt.type.includes('NODE_CAPTURED') || evt.type.includes('MATCH_COMPLETED')) {
                  typeColor = 'var(--accent-green)';
                }

                return (
                  <div key={evt.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>[{time}]</span>
                    <span style={{ color: typeColor, fontWeight: 700, flexShrink: 0 }}>{evt.type}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {evt.username ? `user:${evt.username}` : ''}
                      {evt.matchId ? ` match:${evt.matchId.slice(0, 8)}` : ''}
                      {evt.duration !== undefined ? ` (${evt.duration}ms)` : ''}
                      {evt.reason ? ` - ${evt.reason}` : ''}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={terminalEndRef} />
          </div>
        </div>

        {/* Right: Security Operations Center Panel */}
        <div className="cyber-card" style={{ padding: '24px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '8px',
            }}
          >
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '0.1em' }}>
              SECURITY &amp; ANOMALY SURVEILLANCE
            </div>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="cyber-input"
              style={{
                width: 'auto',
                fontSize: '0.75rem',
                padding: '4px 8px',
              }}
            >
              <option value="ALL">ALL SEVERITIES</option>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </div>

          {/* Security Summary Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px',
              marginBottom: '16px',
            }}
          >
            <div style={{ padding: '8px', textAlign: 'center', backgroundColor: 'rgba(0, 240, 255, 0.05)', border: '1px solid rgba(0, 240, 255, 0.2)', borderRadius: '4px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>LOW</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--accent-cyan)', fontWeight: 800 }}>
                {securitySummary?.lowCount ?? 0}
              </div>
            </div>
            <div style={{ padding: '8px', textAlign: 'center', backgroundColor: 'rgba(255, 255, 0, 0.05)', border: '1px solid rgba(255, 255, 0, 0.2)', borderRadius: '4px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>MED</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: '#ffcc00', fontWeight: 800 }}>
                {securitySummary?.mediumCount ?? 0}
              </div>
            </div>
            <div style={{ padding: '8px', textAlign: 'center', backgroundColor: 'rgba(255, 170, 0, 0.05)', border: '1px solid rgba(255, 170, 0, 0.2)', borderRadius: '4px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>HIGH</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--accent-amber)', fontWeight: 800 }}>
                {securitySummary?.highCount ?? 0}
              </div>
            </div>
            <div style={{ padding: '8px', textAlign: 'center', backgroundColor: 'rgba(255, 0, 85, 0.05)', border: '1px solid rgba(255, 0, 85, 0.2)', borderRadius: '4px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>CRIT</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--accent-magenta)', fontWeight: 800 }}>
                {securitySummary?.criticalCount ?? 0}
              </div>
            </div>
          </div>

          {/* Anomaly Watchlist */}
          {anomalyReports.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                ANOMALY DETECTION WATCHLIST:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {anomalyReports.slice(0, 3).map((rep) => (
                  <div
                    key={rep.userId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '4px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{rep.username || rep.userId.slice(0, 8)}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ color: rep.score > 60 ? 'var(--accent-magenta)' : 'var(--accent-amber)', fontWeight: 800 }}>
                        SCORE: {rep.score}/100
                      </span>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          padding: '2px 6px',
                          borderRadius: '2px',
                          background: rep.score > 60 ? 'rgba(255,0,85,0.2)' : 'rgba(255,184,0,0.2)',
                          color: rep.score > 60 ? 'var(--accent-magenta)' : 'var(--accent-amber)',
                          border: `1px solid ${rep.score > 60 ? 'var(--accent-magenta)' : 'var(--accent-amber)'}`,
                        }}
                      >
                        {rep.level}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Security Events Stream */}
          <div
            style={{
              height: anomalyReports.length > 0 ? '220px' : '300px',
              backgroundColor: '#020409',
              border: '1px solid var(--border-subtle)',
              borderRadius: '4px',
              padding: '12px',
              overflowY: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            {filteredSecEvents.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '12px' }}>
                No security incidents detected. Perimeter intact.
              </div>
            ) : (
              filteredSecEvents.map((sec) => {
                let badgeColor = 'var(--accent-cyan)';
                if (sec.severity === 'CRITICAL') badgeColor = 'var(--accent-magenta)';
                else if (sec.severity === 'HIGH') badgeColor = 'var(--accent-amber)';
                else if (sec.severity === 'MEDIUM') badgeColor = '#ffcc00';

                return (
                  <div
                    key={sec.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      paddingBottom: '4px',
                    }}
                  >
                    <span
                      style={{
                        padding: '1px 5px',
                        border: `1px solid ${badgeColor}`,
                        color: badgeColor,
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        borderRadius: '2px',
                        flexShrink: 0,
                      }}
                    >
                      {sec.severity}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{sec.type}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                        {sec.username ? `user:${sec.username}` : ''}
                        {sec.context ? ` ${JSON.stringify(sec.context)}` : ''}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

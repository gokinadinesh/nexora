import React, { useState } from 'react';

export const JournalPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'levels' | 'tactics'>('levels');

  return (
    <div style={{
      maxWidth: '900px',
      margin: '0 auto',
      padding: '24px',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)',
      animation: 'fadeIn 0.5s ease-out'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '2.5rem',
          color: 'var(--accent-cyan)',
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          textShadow: '0 0 15px rgba(0, 243, 255, 0.4)',
          margin: '0 0 8px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          INTEL / FIELD MANUAL
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', margin: 0 }}>
          Master the Grid: Official documentation for Map Levels and Combat Tactics.
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '24px',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        <button
          onClick={() => setActiveTab('levels')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'levels' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            fontFamily: 'var(--font-display)',
            fontSize: '1.1rem',
            padding: '12px 24px',
            cursor: 'pointer',
            borderBottom: activeTab === 'levels' ? '2px solid var(--accent-cyan)' : '2px solid transparent',
            transition: 'all 0.2s ease',
            textTransform: 'uppercase',
            letterSpacing: '0.1em'
          }}
        >
          Map Levels
        </button>
        <button
          onClick={() => setActiveTab('tactics')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'tactics' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            fontFamily: 'var(--font-display)',
            fontSize: '1.1rem',
            padding: '12px 24px',
            cursor: 'pointer',
            borderBottom: activeTab === 'tactics' ? '2px solid var(--accent-cyan)' : '2px solid transparent',
            transition: 'all 0.2s ease',
            textTransform: 'uppercase',
            letterSpacing: '0.1em'
          }}
        >
          Combat Tactics
        </button>
      </div>

      {/* Content Area */}
      <div className="glass-panel" style={{ padding: '32px', borderRadius: '8px', minHeight: '400px' }}>
        
        {activeTab === 'levels' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <h2 style={{ color: 'var(--accent-cyan)', marginBottom: '24px', fontFamily: 'var(--font-display)' }}>GRID ARCHITECTURE</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '32px' }}>
              The NEXORA grid scales dynamically based on the threat level of the encounter. Each tier introduces larger arenas, more nodes, and highly contested zones.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Level 1 */}
              <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '24px', borderLeft: '4px solid var(--accent-cyan)', borderRadius: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.4rem', fontFamily: 'var(--font-mono)' }}>LEVEL 1: DUEL ARENA</h3>
                  <span className="cyber-badge" style={{ padding: '4px 12px' }}>5x5 GRID</span>
                </div>
                <ul style={{ color: 'var(--text-secondary)', lineHeight: '1.8', margin: 0, paddingLeft: '20px' }}>
                  <li><strong>Total Nodes:</strong> 25 strategic points</li>
                  <li><strong>High-Value Spawns:</strong> 2 Special Nodes (200 PTS)</li>
                  <li><strong>Description:</strong> A tight, fast-paced arena designed for intense 1v1 engagements. Control over the randomized special nodes is critical early on.</li>
                </ul>
              </div>

              {/* Level 2 */}
              <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '24px', borderLeft: '4px solid var(--accent-amber)', borderRadius: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.4rem', fontFamily: 'var(--font-mono)' }}>LEVEL 2: SKIRMISH</h3>
                  <span className="cyber-badge status-offline" style={{ padding: '4px 12px' }}>7x7 GRID</span>
                </div>
                <ul style={{ color: 'var(--text-secondary)', lineHeight: '1.8', margin: 0, paddingLeft: '20px' }}>
                  <li><strong>Total Nodes:</strong> 49 strategic points</li>
                  <li><strong>High-Value Spawns:</strong> 4 Special Nodes (200 PTS)</li>
                  <li><strong>Description:</strong> A medium-sized combat zone. Requires spreading out forces and predicting opponent expansion paths to secure victory.</li>
                </ul>
              </div>

              {/* Level 3 */}
              <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '24px', borderLeft: '4px solid var(--accent-red)', borderRadius: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.4rem', fontFamily: 'var(--font-mono)' }}>LEVEL 3: WARZONE</h3>
                  <span className="cyber-badge status-critical" style={{ padding: '4px 12px', background: 'rgba(255,51,102,0.1)', color: '#ff3366', border: '1px solid #ff3366' }}>10x10 GRID</span>
                </div>
                <ul style={{ color: 'var(--text-secondary)', lineHeight: '1.8', margin: 0, paddingLeft: '20px' }}>
                  <li><strong>Total Nodes:</strong> 100 strategic points</li>
                  <li><strong>High-Value Spawns:</strong> 8 Special Nodes (200 PTS)</li>
                  <li><strong>Description:</strong> Massive tactical theater. Special nodes are scattered unpredictably. Players must balance aggressive pushes with defensive node locking.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tactics' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <h2 style={{ color: 'var(--accent-amber)', marginBottom: '24px', fontFamily: 'var(--font-display)' }}>COMBAT DOCTRINE</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              
              <div style={{ background: 'rgba(255, 183, 0, 0.05)', padding: '20px', borderRadius: '4px', border: '1px solid rgba(255, 183, 0, 0.2)' }}>
                <h3 style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)', marginTop: 0 }}>VICTORY CONDITION</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.95rem' }}>
                  The first Operator to reach <strong>1500 PTS</strong> automatically wins the match. Monitor the progress bar at the top of the HUD to track the score differential in real-time.
                </p>
              </div>

              <div style={{ background: 'rgba(0, 243, 255, 0.05)', padding: '20px', borderRadius: '4px', border: '1px solid rgba(0, 243, 255, 0.2)' }}>
                <h3 style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', marginTop: 0 }}>NODE SCORING</h3>
                <ul style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.95rem', margin: 0, paddingLeft: '20px' }}>
                  <li style={{ marginBottom: '8px' }}><strong>Standard Nodes:</strong> Yield <strong>10 PTS</strong> each. These form the backbone of your territory.</li>
                  <li><strong>Special Nodes:</strong> Yield <strong>200 PTS</strong> each. Glowing and highly contested.</li>
                </ul>
              </div>

              <div style={{ background: 'rgba(0, 243, 255, 0.05)', padding: '20px', borderRadius: '4px', border: '1px solid rgba(0, 243, 255, 0.2)' }}>
                <h3 style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', marginTop: 0 }}>DYNAMIC SPAWNS</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.95rem' }}>
                  Special Nodes (200 PTS) no longer spawn in fixed patterns. At the start of every match, the system shuffles their coordinates. Adapt your strategy on the fly based on where they appear.
                </p>
              </div>

              <div style={{ background: 'rgba(255, 183, 0, 0.05)', padding: '20px', borderRadius: '4px', border: '1px solid rgba(255, 183, 0, 0.2)' }}>
                <h3 style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)', marginTop: 0 }}>EXPANSION & BLOCKING</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.95rem' }}>
                  You can only capture nodes adjacent to your existing territory. Use this to your advantage: cut off your opponent's path to High-Value nodes to stall their momentum.
                </p>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};

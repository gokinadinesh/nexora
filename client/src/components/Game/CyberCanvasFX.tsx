import React, { useEffect, useRef } from 'react';
import { GridNode } from '@nexora/shared';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
  size: number;
  life: number;
}

interface CyberCanvasFXProps {
  grid: Record<string, GridNode>;
  myPlayerRole?: string;
  lastActionNodeId?: string | null;
  lastActionType?: string | null;
}

export const CyberCanvasFX: React.FC<CyberCanvasFXProps> = ({
  grid,
  lastActionNodeId,
  lastActionType,
  myPlayerRole,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // Trigger shockwave when an action happens on a node
  useEffect(() => {
    if (!lastActionNodeId) return;

    // Node coordinates to canvas percentage
    const r = parseInt(lastActionNodeId[1], 10);
    const c = parseInt(lastActionNodeId[2], 10);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const maxRow = Math.max(...Object.keys(grid).map(k => parseInt(k[1], 10)).filter(n => !isNaN(n)));
    const maxCol = Math.max(...Object.keys(grid).map(k => parseInt(k[2], 10)).filter(n => !isNaN(n)));
    const cols = isFinite(maxCol) ? maxCol + 1 : 5;
    const rows = isFinite(maxRow) ? maxRow + 1 : 5;

    const cellWidth = canvas.width / cols;
    const cellHeight = canvas.height / rows;
    const centerX = c * cellWidth + cellWidth / 2;
    const centerY = r * cellHeight + cellHeight / 2;

    let color = '#00f0ff';
    if (lastActionType === 'ATTACK') color = '#ff0055';
    if (lastActionType === 'DEFEND') color = '#00ff88';
    if (lastActionNodeId === 'N22') color = '#ffd700'; // Core node gold

    // Spawn 24 burst particles
    for (let i = 0; i < 24; i++) {
      const angle = (Math.PI * 2 * i) / 24;
      const speed = 1.5 + Math.random() * 3.5;
      particlesRef.current.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        color,
        size: 2 + Math.random() * 3,
        life: 1,
      });
    }
  }, [lastActionNodeId, lastActionType]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    resize();
    window.addEventListener('resize', resize);

    let frameCount = 0;

    const render = () => {
      frameCount++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const maxRow = Math.max(...Object.keys(grid).map(k => parseInt(k[1], 10)).filter(n => !isNaN(n)));
      const maxCol = Math.max(...Object.keys(grid).map(k => parseInt(k[2], 10)).filter(n => !isNaN(n)));
      const cols = isFinite(maxCol) ? maxCol + 1 : 5;
      const rows = isFinite(maxRow) ? maxRow + 1 : 5;

      const cellW = canvas.width / cols;
      const cellH = canvas.height / rows;

      // 1. Draw Network Circuit Conduits between adjacent friendly nodes
      ctx.lineWidth = 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const currentId = `N${r}${c}`;
          const currentNode = grid[currentId];
          if (!currentNode || currentNode.owner === 'NEUTRAL') continue;

          const startX = c * cellW + cellW / 2;
          const startY = r * cellH + cellH / 2;

          // Check Right neighbor
          if (c < cols - 1) {
            const rightNode = grid[`N${r}${c + 1}`];
            if (rightNode && rightNode.owner === currentNode.owner) {
              const endX = (c + 1) * cellW + cellW / 2;
              const isMe = currentNode.owner === myPlayerRole;
              const pulse = (Math.sin(frameCount * 0.05 + r + c) + 1) / 2;

              ctx.strokeStyle = isMe
                ? `rgba(0, 240, 255, ${0.25 + pulse * 0.45})`
                : `rgba(255, 0, 85, ${0.25 + pulse * 0.45})`;
              ctx.shadowColor = isMe ? '#00f0ff' : '#ff0055';
              ctx.shadowBlur = 8 * pulse;

              ctx.beginPath();
              ctx.moveTo(startX, startY);
              ctx.lineTo(endX, startY);
              ctx.stroke();
            }
          }

          // Check Down neighbor
          if (r < rows - 1) {
            const downNode = grid[`N${r + 1}${c}`];
            if (downNode && downNode.owner === currentNode.owner) {
              const endY = (r + 1) * cellH + cellH / 2;
              const isMe = currentNode.owner === myPlayerRole;
              const pulse = (Math.cos(frameCount * 0.05 + r + c) + 1) / 2;

              ctx.strokeStyle = isMe
                ? `rgba(0, 240, 255, ${0.25 + pulse * 0.45})`
                : `rgba(255, 0, 85, ${0.25 + pulse * 0.45})`;
              ctx.shadowColor = isMe ? '#00f0ff' : '#ff0055';
              ctx.shadowBlur = 8 * pulse;

              ctx.beginPath();
              ctx.moveTo(startX, startY);
              ctx.lineTo(startX, endY);
              ctx.stroke();
            }
          }

          // 2. Draw Hexagonal Forcefield on Defended Nodes
          if (currentNode.isDefended) {
            const radius = Math.min(cellW, cellH) * 0.38;
            const rot = frameCount * 0.02;

            ctx.save();
            ctx.translate(startX, startY);
            ctx.rotate(rot);

            ctx.strokeStyle = 'rgba(0, 255, 136, 0.7)';
            ctx.shadowColor = '#00ff88';
            ctx.shadowBlur = 12;
            ctx.lineWidth = 1.8;

            ctx.beginPath();
            for (let s = 0; s < 6; s++) {
              const angle = (Math.PI / 3) * s;
              const hx = radius * Math.cos(angle);
              const hy = radius * Math.sin(angle);
              if (s === 0) ctx.moveTo(hx, hy);
              else ctx.lineTo(hx, hy);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      ctx.shadowBlur = 0; // Reset shadow

      // 3. Update & Draw Shockwave Particles
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.95;
        p.vy *= 0.95;
        p.alpha -= 0.025;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [grid]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 2,
      }}
    />
  );
};

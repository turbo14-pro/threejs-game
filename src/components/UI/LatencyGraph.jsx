import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore';

export default function LatencyGraph() {
  const latency = useGameStore(state => state.game.latency);
  const [history, setHistory] = useState(new Array(20).fill(0));
  const canvasRef = useRef(null);

  useEffect(() => {
    setHistory(prev => {
      const newHistory = [...prev.slice(1), latency];
      return newHistory;
    });
  }, [latency]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const width = canvasRef.current.width;
    const height = canvasRef.current.height;

    ctx.clearRect(0, 0, width, height);
    
    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Draw graph
    ctx.strokeStyle = latency > 150 ? '#ff0055' : latency > 80 ? '#ffcc00' : '#00ffcc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const step = width / (history.length - 1);
    const maxLatency = Math.max(200, ...history);
    
    history.forEach((val, i) => {
      const x = i * step;
      const y = height - (val / maxLatency) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    
    ctx.stroke();
    
    // Fill area
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.fillStyle = latency > 150 ? 'rgba(255, 0, 85, 0.1)' : 'rgba(0, 255, 204, 0.1)';
    ctx.fill();

  }, [history, latency]);

  return (
    <div style={{
      position: 'absolute',
      top: '1rem',
      right: '1rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      pointerEvents: 'none',
      zIndex: 100,
      fontFamily: 'Inter, system-ui, sans-serif',
      textShadow: '0 2px 4px rgba(0,0,0,0.5)'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'baseline', 
        gap: '0.5rem',
        marginBottom: '0.25rem'
      }}>
        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>LATENCY</span>
        <span style={{ 
          fontSize: '1.2rem', 
          fontWeight: 800, 
          color: latency > 150 ? '#ff0055' : latency > 80 ? '#ffcc00' : '#00ffcc' 
        }}>
          {latency}ms
        </span>
      </div>
      <canvas 
        ref={canvasRef} 
        width={120} 
        height={40} 
        style={{ 
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '4px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}
      />
    </div>
  );
}

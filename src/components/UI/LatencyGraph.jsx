import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore';

export default function LatencyGraph() {
  const latency = useGameStore(state => state.game.latency);
  const [latHistory, setLatHistory] = useState(new Array(20).fill(0));
  const latCanvasRef = useRef(null);

  const [fps, setFps] = useState(0);
  const [fpsHistory, setFpsHistory] = useState(new Array(20).fill(60));
  const fpsCanvasRef = useRef(null);
  const frames = useRef(0);
  const lastTime = useRef(performance.now());

  // FPS counter
  useEffect(() => {
    let raf;
    const tick = (now) => {
      frames.current++;
      if (now - lastTime.current >= 1000) {
        const val = frames.current;
        setFps(val);
        setFpsHistory(prev => [...prev.slice(1), val]);
        frames.current = 0;
        lastTime.current = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Latency history
  useEffect(() => {
    setLatHistory(prev => [...prev.slice(1), latency]);
  }, [latency]);

  // Draw latency graph
  useEffect(() => {
    if (!latCanvasRef.current) return;
    const ctx = latCanvasRef.current.getContext('2d');
    const w = latCanvasRef.current.width;
    const h = latCanvasRef.current.height;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    const color = latency > 150 ? '#ff0055' : latency > 80 ? '#ffcc00' : '#00ffcc';
    const step = w / (latHistory.length - 1);
    const max = Math.max(200, ...latHistory);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    latHistory.forEach((val, i) => {
      const x = i * step;
      const y = h - (val / max) * h;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.fillStyle = latency > 150 ? 'rgba(255,0,85,0.1)' : 'rgba(0,255,204,0.1)';
    ctx.fill();
  }, [latHistory, latency]);

  // Draw FPS graph
  useEffect(() => {
    if (!fpsCanvasRef.current) return;
    const ctx = fpsCanvasRef.current.getContext('2d');
    const w = fpsCanvasRef.current.width;
    const h = fpsCanvasRef.current.height;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    const color = fps >= 50 ? '#00ffcc' : fps >= 30 ? '#ffcc00' : '#ff0055';
    const step = w / (fpsHistory.length - 1);
    const max = Math.max(60, ...fpsHistory);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    fpsHistory.forEach((val, i) => {
      const x = i * step;
      const y = h - (val / max) * h;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.fillStyle = fps >= 50 ? 'rgba(0,255,204,0.1)' : fps >= 30 ? 'rgba(255,204,0,0.1)' : 'rgba(255,0,85,0.1)';
    ctx.fill();
  }, [fpsHistory, fps]);

  const graphStyle = {
    background: 'rgba(0,0,0,0.3)',
    borderRadius: '4px',
    border: '1px solid rgba(255,255,255,0.1)'
  };

  return (
    <div style={{
      position: 'absolute',
      top: '1rem',
      right: '1rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: '0.4rem',
      pointerEvents: 'none',
      zIndex: 100,
      fontFamily: 'Inter, system-ui, sans-serif',
      textShadow: '0 2px 4px rgba(0,0,0,0.5)'
    }}>
      {/* Latency */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>LATENCY</span>
        <span style={{
          fontSize: '1.2rem', fontWeight: 800,
          color: latency > 150 ? '#ff0055' : latency > 80 ? '#ffcc00' : '#00ffcc'
        }}>{latency}ms</span>
      </div>
      <canvas ref={latCanvasRef} width={120} height={40} style={graphStyle} />

      {/* FPS */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.15rem' }}>
        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>FPS</span>
        <span style={{
          fontSize: '1.2rem', fontWeight: 800,
          color: fps >= 50 ? '#00ffcc' : fps >= 30 ? '#ffcc00' : '#ff0055'
        }}>{fps}</span>
      </div>
      <canvas ref={fpsCanvasRef} width={120} height={40} style={graphStyle} />
    </div>
  );
}

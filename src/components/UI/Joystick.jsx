import React, { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../../store/useGameStore';

export default function Joystick() {
  const setMobileInput = useGameStore(state => state.setMobileInput);
  const [isActive, setIsActive] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const baseRef = useRef(null);

  const handleTouch = (e) => {
    if (!baseRef.current) return;
    const touch = e.touches[0];
    const rect = baseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Calculate relative distance from center
    const maxRadius = rect.width / 2;
    let dx = touch.clientX - centerX;
    let dy = touch.clientY - centerY;
    
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    
    if (distance > maxRadius) {
      dx = Math.cos(angle) * maxRadius;
      dy = Math.sin(angle) * maxRadius;
    }
    
    // Normalize to -1...1
    const nx = dx / maxRadius;
    const ny = dy / maxRadius;
    
    setPos({ x: dx, y: dy });
    setMobileInput({ x: nx, y: -ny }); // Note: ny is inverted for 3D forward
  };

  const endTouch = () => {
    setIsActive(false);
    setPos({ x: 0, y: 0 });
    setMobileInput({ x: 0, y: 0 });
  };

  return (
    <div 
      className="joystick-container"
      onTouchStart={(e) => { setIsActive(true); handleTouch(e); }}
      onTouchMove={handleTouch}
      onTouchEnd={endTouch}
    >
      <div className="joystick-base" ref={baseRef}>
        <div 
          className="joystick-knob"
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px)`,
            transition: isActive ? 'none' : 'transform 0.1s'
          }}
        />
      </div>
    </div>
  );
}

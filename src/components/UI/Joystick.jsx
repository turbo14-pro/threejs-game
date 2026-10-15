import React, { useState, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore';

export default function Joystick() {
  const setMobileInput = useGameStore(state => state.setMobileInput);
  const [isActive, setIsActive] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const baseRef = useRef(null);
  const touchIdRef = useRef(null);

  const handleTouch = (touch) => {
    if (!baseRef.current) return;
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

  const handleTouchStart = (e) => {
    if (touchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    touchIdRef.current = touch.identifier;
    setIsActive(true);
    handleTouch(touch);
  };

  const handleTouchMove = (e) => {
    for (const touch of e.changedTouches) {
      if (touch.identifier === touchIdRef.current) {
        handleTouch(touch);
        return;
      }
    }
  };

  const endTouch = (e) => {
    for (const touch of e.changedTouches) {
      if (touch.identifier === touchIdRef.current) {
        touchIdRef.current = null;
        setIsActive(false);
        setPos({ x: 0, y: 0 });
        setMobileInput({ x: 0, y: 0 });
        return;
      }
    }
  };

  return (
    <div 
      className="joystick-container"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={endTouch}
      onTouchCancel={endTouch}
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

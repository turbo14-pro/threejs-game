import React, { useState, useRef, useCallback } from 'react';
import { useGameStore } from '../../store/useGameStore';

// Camera joystick tuning constants
const RADIUS = 50;          // Visual radius of joystick knob travel
const DEAD_ZONE = 0.08;     // 8% of radius — ignore tiny movements
const RESPONSE_CURVE = 2.5; // Exponential curve (>1 = slow near center, fast at edge)
const MAX_SPEED = 0.035;    // Max radians per frame at full deflection
const BASE_SPEED = 0.006;   // Minimum speed at edge with curve applied

export default function CameraJoystick() {
  const setCameraInput = useGameStore(state => state.setCameraInput);
  const [isActive, setIsActive] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const baseRef = useRef(null);
  const touchIdRef = useRef(null);
  const lastTouch = useRef({ x: 0, y: 0 });

  // Apply dead zone + response curve + max speed cap
  const processInput = useCallback((dx, dy) => {
    const dist = Math.sqrt(dx * dx + dy * dy);
    const normalized = dist / RADIUS; // 0..1

    // Dead zone
    if (normalized < DEAD_ZONE) {
      return { x: 0, y: 0 };
    }

    // Remap from [DEAD_ZONE..1] to [0..1]
    const remapped = (normalized - DEAD_ZONE) / (1 - DEAD_ZONE);

    // Exponential response curve
    const curved = Math.pow(remapped, RESPONSE_CURVE);

    // Scale to speed range
    const speed = BASE_SPEED + curved * (MAX_SPEED - BASE_SPEED);

    // Normalize direction
    const angle = Math.atan2(dy, dx);

    return {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed
    };
  }, []);

  const handleTouchStart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (touchIdRef.current !== null) return;

    const touch = e.changedTouches[0];
    touchIdRef.current = touch.identifier;
    setIsActive(true);

    const rect = baseRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    lastTouch.current = { x: touch.clientX - cx, y: touch.clientY - cy };
    setPos({ x: 0, y: 0 });
  }, []);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier !== touchIdRef.current) continue;

      const rect = baseRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      // Raw offset from center
      let rawDx = touch.clientX - cx;
      let rawDy = touch.clientY - cy;
      const rawDist = Math.sqrt(rawDx * rawDx + rawDy * rawDy);

      // Clamp to radius for visual knob position
      let knobX = rawDx;
      let knobY = rawDy;
      if (rawDist > RADIUS) {
        const angle = Math.atan2(rawDy, rawDx);
        knobX = Math.cos(angle) * RADIUS;
        knobY = Math.sin(angle) * RADIUS;
      }
      setPos({ x: knobX, y: knobY });

      // Process through dead zone + curve + cap
      const processed = processInput(rawDx, rawDy);

      // Invert axes: pushing right = look right (negative yaw)
      setCameraInput({ x: -processed.x, y: -processed.y });

      lastTouch.current = { x: knobX, y: knobY };
      return;
    }
  }, [setCameraInput, processInput]);

  const handleTouchEnd = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchIdRef.current) {
        touchIdRef.current = null;
        setIsActive(false);
        setPos({ x: 0, y: 0 });
        setCameraInput({ x: 0, y: 0 });
        return;
      }
    }
  }, [setCameraInput]);

  return (
    <div
      className="joystick-container camera-joystick"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div className="joystick-base camera-joystick-base" ref={baseRef}>
        <div
          className="joystick-knob camera-joystick-knob"
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px)`,
            transition: isActive ? 'none' : 'transform 0.15s ease-out'
          }}
        />
      </div>
    </div>
  );
}

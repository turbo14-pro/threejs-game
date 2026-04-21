---
name: mobile-touch-controls
description: Guide for implementing mobile touch controls including virtual joystick and swipe-based throw mechanics. Use this when working with touch input, gesture recognition, virtual joysticks, or swipe detection.
---

# Mobile Touch Controls for Football Game

This skill provides guidance for implementing mobile-first touch controls including dual-zone input, virtual joysticks, and swipe-based throw mechanics.

## Technology Stack
- **nipple.js** - Virtual joystick library
- **Hammer.js** - Gesture recognition (optional)
- **Canvas-based rendering** - For zero-latency visual feedback
- **Passive event listeners** - For optimal touch response

## Dual-Zone Touch Architecture

The screen is divided into two independent input zones:

| Zone | Position | Purpose | Input Type |
|------|----------|---------|------------|
| Left (Movement) | Bottom-left 120x120px | QB positioning | Virtual joystick |
| Right (Throw) | Right 50% of screen | Throw execution | Swipe gesture |

## Virtual Joystick Implementation

### Using nipple.js

```typescript
import nipplejs from 'nipplejs';

interface JoystickData {
  x: number;  // -1 to 1
  y: number;  // -1 to 1
  magnitude: number;  // 0 to 1
}

function createMovementJoystick(
  container: HTMLElement,
  onMove: (data: JoystickData) => void,
  onEnd: () => void
): nipplejs.JoystickManager {
  const joystick = nipplejs.create({
    zone: container,
    mode: 'static',
    position: { left: '80px', bottom: '80px' },
    color: 'rgba(255, 255, 255, 0.5)',
    size: 120,
    restOpacity: 0.7,
    fadeTime: 100
  });

  joystick.on('move', (evt, data) => {
    if (data.vector) {
      onMove({
        x: data.vector.x,
        y: -data.vector.y,  // Invert Y for game coordinates
        magnitude: data.force / 2  // Normalize to 0-1
      });
    }
  });

  joystick.on('end', () => {
    onEnd();
  });

  return joystick;
}
```

### Custom Canvas Joystick (Zero Latency)

For absolute minimal latency, use canvas-based rendering:

```typescript
interface JoystickState {
  active: boolean;
  baseX: number;
  baseY: number;
  knobX: number;
  knobY: number;
  vectorX: number;
  vectorY: number;
}

class CanvasJoystick {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: JoystickState = {
    active: false,
    baseX: 80,
    baseY: 0,
    knobX: 80,
    knobY: 0,
    vectorX: 0,
    vectorY: 0
  };
  private radius = 60;
  private knobRadius = 25;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 160;
    this.canvas.height = 160;
    this.canvas.style.cssText = `
      position: absolute;
      left: 0;
      bottom: 0;
      touch-action: none;
      pointer-events: auto;
    `;
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    
    this.state.baseY = this.canvas.height - 80;
    this.state.knobY = this.state.baseY;
    
    this.setupEvents();
    this.render();
  }

  private setupEvents() {
    // Use non-passive for touch events to prevent scrolling
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
  }

  private handleTouchStart(e: TouchEvent) {
    e.preventDefault();
    this.state.active = true;
    this.updateKnobPosition(e.touches[0]);
  }

  private handleTouchMove(e: TouchEvent) {
    e.preventDefault();
    if (!this.state.active) return;
    this.updateKnobPosition(e.touches[0]);
  }

  private handleTouchEnd(e: TouchEvent) {
    e.preventDefault();
    this.state.active = false;
    this.state.knobX = this.state.baseX;
    this.state.knobY = this.state.baseY;
    this.state.vectorX = 0;
    this.state.vectorY = 0;
    this.render();
  }

  private updateKnobPosition(touch: Touch) {
    const rect = this.canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    const dx = x - this.state.baseX;
    const dy = y - this.state.baseY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Clamp to radius
    if (distance <= this.radius) {
      this.state.knobX = x;
      this.state.knobY = y;
    } else {
      const angle = Math.atan2(dy, dx);
      this.state.knobX = this.state.baseX + Math.cos(angle) * this.radius;
      this.state.knobY = this.state.baseY + Math.sin(angle) * this.radius;
    }
    
    // Calculate normalized vector (-1 to 1)
    this.state.vectorX = (this.state.knobX - this.state.baseX) / this.radius;
    this.state.vectorY = -(this.state.knobY - this.state.baseY) / this.radius; // Invert Y
    
    this.render();
  }

  private render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw base circle
    this.ctx.beginPath();
    this.ctx.arc(this.state.baseX, this.state.baseY, this.radius, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(100, 100, 100, 0.3)';
    this.ctx.fill();
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    
    // Draw knob
    this.ctx.beginPath();
    this.ctx.arc(this.state.knobX, this.state.knobY, this.knobRadius, 0, Math.PI * 2);
    const gradient = this.ctx.createRadialGradient(
      this.state.knobX, this.state.knobY, 0,
      this.state.knobX, this.state.knobY, this.knobRadius
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(200, 200, 200, 0.5)');
    this.ctx.fillStyle = gradient;
    this.ctx.fill();
  }

  getVector(): { x: number; y: number } {
    return { x: this.state.vectorX, y: this.state.vectorY };
  }

  destroy() {
    this.canvas.remove();
  }
}
```

## Swipe-Based Throw Mechanics

### Throw Zone Implementation

```typescript
interface ThrowData {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  duration: number;
  velocity: number;
  angle: number;
}

interface ThrowZoneProps {
  onThrowStart: () => void;
  onThrowMove: (angle: number, power: number) => void;
  onThrowEnd: (data: ThrowData) => void;
}

class ThrowZone {
  private element: HTMLElement;
  private touchStartTime: number = 0;
  private touchStartX: number = 0;
  private touchStartY: number = 0;
  private props: ThrowZoneProps;

  constructor(container: HTMLElement, props: ThrowZoneProps) {
    this.props = props;
    
    this.element = document.createElement('div');
    this.element.style.cssText = `
      position: absolute;
      right: 0;
      top: 0;
      width: 50%;
      height: 100%;
      touch-action: none;
    `;
    container.appendChild(this.element);
    
    this.setupEvents();
  }

  private setupEvents() {
    this.element.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.element.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.element.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    this.element.addEventListener('touchcancel', this.handleTouchEnd.bind(this), { passive: false });
  }

  private handleTouchStart(e: TouchEvent) {
    e.preventDefault();
    const touch = e.touches[0];
    this.touchStartTime = performance.now();
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.props.onThrowStart();
  }

  private handleTouchMove(e: TouchEvent) {
    e.preventDefault();
    const touch = e.touches[0];
    
    const dx = touch.clientX - this.touchStartX;
    const dy = touch.clientY - this.touchStartY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Calculate angle (0 = right, 90 = up, 180 = left, -90 = down)
    const angle = Math.atan2(-dy, dx); // Invert Y for screen coords
    
    // Calculate power (0-100 based on distance, max at 300px)
    const power = Math.min(distance / 300, 1) * 100;
    
    this.props.onThrowMove(angle, power);
  }

  private handleTouchEnd(e: TouchEvent) {
    e.preventDefault();
    
    // Use changedTouches for touchend
    const touch = e.changedTouches[0];
    const duration = performance.now() - this.touchStartTime;
    
    const dx = touch.clientX - this.touchStartX;
    const dy = touch.clientY - this.touchStartY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Velocity = distance / time (pixels per millisecond)
    const velocity = distance / duration;
    const angle = Math.atan2(-dy, dx);
    
    this.props.onThrowEnd({
      startX: this.touchStartX,
      startY: this.touchStartY,
      endX: touch.clientX,
      endY: touch.clientY,
      duration,
      velocity,
      angle
    });
  }

  destroy() {
    this.element.remove();
  }
}
```

## Input Latency Optimization

### Critical: Use Non-Passive Event Listeners

```typescript
// GOOD - Prevents 100-300ms delay on mobile
canvas.addEventListener('touchstart', handler, { passive: false });
canvas.addEventListener('touchmove', handler, { passive: false });

// BAD - Can add significant latency
canvas.addEventListener('touchstart', handler); // Uses default passive: true
```

### Bypass DOM Reflow

```typescript
// GOOD - Direct canvas manipulation
ctx.clearRect(0, 0, width, height);
ctx.drawImage(joystickSprite, x, y);

// BAD - DOM manipulation triggers reflow
joystickElement.style.left = `${x}px`;
joystickElement.style.top = `${y}px`;
```

### Target: touchstart → visual response < 16ms (single frame at 60fps)

## React Component Example

```tsx
"use client";

import { useRef, useEffect, useCallback } from 'react';

interface VirtualJoystickProps {
  onMove: (x: number, y: number) => void;
  onEnd: () => void;
}

export function VirtualJoystick({ onMove, onEnd }: VirtualJoystickProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    active: false,
    baseX: 80,
    baseY: 80,
    knobX: 80,
    knobY: 80
  });

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    
    const { baseX, baseY, knobX, knobY } = stateRef.current;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Base
    ctx.beginPath();
    ctx.arc(baseX, baseY, 50, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(100, 100, 100, 0.3)';
    ctx.fill();
    
    // Knob
    ctx.beginPath();
    ctx.arc(knobX, knobY, 25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fill();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const handleTouch = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0] || e.changedTouches[0];
      const rect = canvas.getBoundingClientRect();
      
      if (e.type === 'touchstart') {
        stateRef.current.active = true;
      } else if (e.type === 'touchend') {
        stateRef.current.active = false;
        stateRef.current.knobX = stateRef.current.baseX;
        stateRef.current.knobY = stateRef.current.baseY;
        onEnd();
        render();
        return;
      }
      
      if (!stateRef.current.active) return;
      
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      const { baseX, baseY } = stateRef.current;
      
      const dx = x - baseX;
      const dy = y - baseY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxRadius = 50;
      
      if (distance <= maxRadius) {
        stateRef.current.knobX = x;
        stateRef.current.knobY = y;
      } else {
        const angle = Math.atan2(dy, dx);
        stateRef.current.knobX = baseX + Math.cos(angle) * maxRadius;
        stateRef.current.knobY = baseY + Math.sin(angle) * maxRadius;
      }
      
      const normalizedX = (stateRef.current.knobX - baseX) / maxRadius;
      const normalizedY = -(stateRef.current.knobY - baseY) / maxRadius;
      
      onMove(normalizedX, normalizedY);
      render();
    };
    
    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    canvas.addEventListener('touchmove', handleTouch, { passive: false });
    canvas.addEventListener('touchend', handleTouch, { passive: false });
    
    render();
    
    return () => {
      canvas.removeEventListener('touchstart', handleTouch);
      canvas.removeEventListener('touchmove', handleTouch);
      canvas.removeEventListener('touchend', handleTouch);
    };
  }, [onMove, onEnd, render]);

  return (
    <div
      ref={containerRef}
      className="absolute left-4 bottom-4 touch-none"
    >
      <canvas
        ref={canvasRef}
        width={160}
        height={160}
        className="touch-none"
      />
    </div>
  );
}
```

## Haptic Feedback

```typescript
function triggerHaptic(type: 'light' | 'medium' | 'heavy') {
  if ('vibrate' in navigator) {
    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30, 10, 30]
    };
    navigator.vibrate(patterns[type]);
  }
}

// Trigger on throw release
onThrowEnd((data) => {
  triggerHaptic('medium');
  processThrow(data);
});
```

## Preventing Default Touch Behaviors

```css
/* Prevent zoom and scroll on game container */
.game-container {
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
```

## References

- [nipple.js Documentation](https://yoannmoi.net/nipplejs/)
- [Hammer.js Documentation](https://hammerjs.github.io/)
- [Touch Events MDN](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events)

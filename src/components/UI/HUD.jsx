import React, { useState, useEffect, useMemo } from 'react';
import { useGameStore } from '../../store/useGameStore';
import Joystick from './Joystick.jsx';
import CameraJoystick from './CameraJoystick.jsx';
import Options from './Options.jsx';
import LatencyGraph from './LatencyGraph.jsx';
import { PowerUpHUD } from './PowerUpHUD.jsx';
import { PowerUpNotification } from './PowerUpNotification.jsx';

export default function HUD() {
  const matchPhase = useGameStore(state => state.game.phase);
  const countdown = useGameStore(state => state.game.countdown);
  const setGameState = useGameStore(state => state.setGameState);
  const setMobileInput = useGameStore(state => state.setMobileInput);
  const mobileInput = useGameStore(state => state.mobileInput);
  const powerUp = useGameStore(state => state.powerUp);
  const rippleDebug = useGameStore(state => state.debugRipple);
  
  const [isPaused, setIsPaused] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showControls, setShowControls] = useState(false); // Added Controls state
  const [showTutorial, setShowTutorial] = useState(true);
  const [isTouchDevice, setIsTouchDevice] = useState(false);


  useEffect(() => {
    // Detect touch device
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);

    const handlePointerLockChange = () => {
      const locked = !!document.pointerLockElement;
      setIsPaused(!locked);
      if (locked) {
        setShowOptions(false);
        setShowHelp(false);
        setShowControls(false); // Reset controls on lock
      }
    };


    document.addEventListener('pointerlockchange', handlePointerLockChange);

    // Hide tutorial after 6 seconds
    const timer = setTimeout(() => setShowTutorial(false), 6000);

    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      clearTimeout(timer);
    };
  }, []);

  const handleResume = () => {
    if (isTouchDevice) {
      setIsPaused(false);
    } else {
      const canvas = document.querySelector('canvas');
      if (canvas) canvas.requestPointerLock();
    }
  };

  const handleQuit = () => {
    if (document.pointerLockElement) document.exitPointerLock();
    setGameState('MENU');
  };

  const handleRespawn = () => {
    useGameStore.getState().respawnToLobby();
  };

  const rippleDebugLabel = useMemo(() => {
    const pos = rippleDebug?.worldPosition;
    if (!pos) return 'Ripple debug: n/a';
    return `Ripple debug: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)} | screen ${rippleDebug.screenPosition?.x?.toFixed(0) ?? '0'}, ${rippleDebug.screenPosition?.y?.toFixed(0) ?? '0'}`;
  }, [rippleDebug]);

  const rippleRingStyles = useMemo(() => {
    const x = rippleDebug?.screenPosition?.x ?? 0;
    const y = rippleDebug?.screenPosition?.y ?? 0;
    const left = `${Math.max(12, Math.min(window.innerWidth - 12, x))}px`;
    const top = `${Math.max(12, Math.min(window.innerHeight - 12, y))}px`;

    return Array.from({ length: 3 }, (_, index) => ({
      position: 'absolute',
      left,
      top,
      transform: 'translate(-50%, -50%)',
      width: 140 + index * 100,
      height: 140 + index * 100,
      borderRadius: '50%',
      border: `${index === 0 ? 10 : 8}px solid rgba(125, 231, 255, 0.22)`,
      background: 'rgba(125, 231, 255, 0.015)',
      boxShadow: '0 0 24px rgba(125, 231, 255, 0.12)',
      backdropFilter: 'blur(6px)',
      zIndex: 22,
      pointerEvents: 'none',
      animation: 'ripple-debug-pulse 1.4s ease-out infinite',
      animationDelay: `${index * 0.35}s`,
      opacity: 0.25,
    }));
  }, [rippleDebug?.screenPosition]);

  return (
    <div className="game-hud-root">
      {/* Dynamic Tutorial Overlay */}
      {showTutorial && !isPaused && (
        <div className="tutorial-overlay">
          <div className="tutorial-content">
            <h2>CONTROLS</h2>
            {!isTouchDevice ? (
              <div className="controls-grid">
                <div className="control-row"><span className="key">WASD</span> MOVE</div>
                <div className="control-row"><span className="key">SHIFT</span> WALK</div>
                <div className="control-row"><span className="key">C</span> SLIDE</div>
                <div className="control-row"><span className="key">SPACE</span> JUMP</div>
                <div className="control-row"><span className="key">MOUSE</span> LOOK</div>
                <div className="control-row"><span className="key">ESC</span> PAUSE</div>
              </div>
            ) : (
              <div className="controls-grid">
                <div className="control-row"><span className="touch-dot"></span> JOYSTICK TO MOVE</div>
                <div className="control-row"><span className="touch-dot"></span> DRAG RIGHT TO LOOK</div>
                <div className="control-row"><span className="btn-small">TAP BUTTONS</span> ACTION</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Latency/FPS Display */}
      {!isPaused && <LatencyGraph />}

      {!isPaused && rippleDebug?.enabled && (
        <>
          <div style={{ position: 'absolute', left: 16, top: 16, zIndex: 20, background: 'rgba(0,0,0,0.55)', color: '#fff', padding: '8px 10px', borderRadius: 6, fontSize: 12, fontFamily: 'monospace', pointerEvents: 'none', maxWidth: 'min(92vw, 420px)' }}>
            <div>{rippleDebugLabel}</div>
            <div style={{ marginTop: 4, color: '#7de7ff' }}>Ripple debug overlay enabled</div>
          </div>
          {rippleRingStyles.map((style, index) => (
            <div key={index} style={style} />
          ))}
        </>
      )}

      {/* Crosshair */}
      {!isPaused && !isTouchDevice && (
        <div className="crosshair">
          <div className="crosshair-center" />
        </div>
      )}

      {/* Hamburger Menu Button (Touch Devices) */}
      {isTouchDevice && !isPaused && (
        <button 
          className="hamburger-btn"
          onTouchStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsPaused(true);
          }}
        >
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
        </button>
      )}

      {/* Mobile Input UI */}
      {isTouchDevice && !isPaused && (
        <>
          <Joystick />
          <div className="camera-controls-area">
            <button
              className="mobile-btn camera-btn jump-btn"
              onTouchStart={(e) => { e.stopPropagation(); setMobileInput({ jump: true }); }}
              onTouchEnd={(e) => { e.stopPropagation(); setMobileInput({ jump: false }); }}
            >JUMP</button>
            <div className="camera-mid-row">
              <button
                className={`mobile-btn camera-btn walk-btn ${mobileInput.walk ? 'walk-active' : 'run-active'}`}
                onTouchStart={(e) => { e.stopPropagation(); e.preventDefault(); setMobileInput({ walk: !mobileInput.walk }); }}
              >{mobileInput.walk ? 'WALK' : 'RUN'}</button>
              <CameraJoystick />
              <button
                className="mobile-btn camera-btn slide-btn"
                onTouchStart={(e) => { e.stopPropagation(); setMobileInput({ slide: true }); }}
                onTouchEnd={(e) => { e.stopPropagation(); setMobileInput({ slide: false }); }}
              >SLIDE</button>
              {powerUp?.category === 'dash' && (
                <button
                  className="mobile-btn camera-btn dash-btn"
                  onTouchStart={(e) => { e.stopPropagation(); setMobileInput({ dash: true }); }}
                  onTouchEnd={(e) => { e.stopPropagation(); setMobileInput({ dash: false }); }}
                >DASH</button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Pause Menu Overlay */}
      {isPaused && (
        <div className="menu-overlay">
          <div className="menu-content" style={{ pointerEvents: 'auto' }}>
            {showOptions ? (
              <Options onBack={() => setShowOptions(false)} />
            ) : showControls ? (
              <>
                <h1>CONTROLS</h1>
                <div className="controls-grid" style={{ marginBottom: '2.5rem' }}>
                  {!isTouchDevice ? (
                    <>
                      <div className="control-row"><span className="key">WASD</span> MOVE</div>
                      <div className="control-row"><span className="key">SHIFT</span> WALK</div>
                      <div className="control-row"><span className="key">C</span> SLIDE</div>
                      <div className="control-row"><span className="key">SPACE</span> JUMP</div>
                      <div className="control-row"><span className="key">MOUSE</span> LOOK</div>
                      <div className="control-row"><span className="key">ESC</span> PAUSE</div>
                    </>
                  ) : (
                    <>
                      <div className="control-row"><span className="touch-dot"></span> JOYSTICK TO MOVE</div>
                      <div className="control-row"><span className="touch-dot"></span> DRAG RIGHT TO LOOK</div>
                      <div className="control-row"><span className="btn-small">TAP BUTTONS</span> ACTION</div>
                    </>
                  )}
                </div>
                <button className="char-btn main-btn" onClick={() => setShowControls(false)}>
                  <span className="btn-name">BACK</span>
                </button>
              </>
            ) : showHelp ? (
              <>
                <h1>HELP</h1>
                <div className="menu-stack">
                  <button className="char-btn main-btn" onClick={() => setShowControls(true)}>
                    <span className="btn-name">CONTROLS</span>
                  </button>
                  <button className="char-btn main-btn" onClick={() => setShowHelp(false)}>
                    <span className="btn-name">BACK</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <h1>PAUSED</h1>
                <div className="menu-stack">
                  <button className="char-btn main-btn" onClick={handleResume}>
                    <span className="btn-name">RESUME</span>
                  </button>
                  <button 
                    className="char-btn main-btn" 
                    onClick={() => setShowOptions(true)}
                  >
                    <span className="btn-name">OPTIONS</span>
                  </button>
                  <button 
                    className="char-btn main-btn" 
                    onClick={() => setShowHelp(true)}
                  >
                    <span className="btn-name">HELP</span>
                  </button>
                  <button className="char-btn main-btn" onClick={handleRespawn}>
                    <span className="btn-name">RESTART</span>
                  </button>
                  <button 
                    className="char-btn main-btn" 
                    style={{ background: 'linear-gradient(45deg, #ff0055, #ff0000)' }} 
                    onClick={handleQuit}
                  >
                    <span className="btn-name">MAIN MENU</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}


      {/* Click-to-resume background */}
      {isPaused && (
        <div 
          onClick={handleResume}
          onTouchEnd={(e) => {
            if (e.target === e.currentTarget) handleResume();
          }}
          style={{ position: 'absolute', inset: 0, zIndex: 10 }}
        />
      )}

      {/* Power-Up HUD */}
      <PowerUpHUD />
      <PowerUpNotification />
    </div>
  );
}

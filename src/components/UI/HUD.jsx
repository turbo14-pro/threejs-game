import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../store/useGameStore';
import Joystick from './Joystick.jsx';
import Options from './Options.jsx';

export default function HUD() {
  const playerHealth = useGameStore(state => state.playerHealth);
  const selectedCharacter = useGameStore(state => state.selectedCharacter);
  const setGameState = useGameStore(state => state.setGameState);
  const setMobileInput = useGameStore(state => state.setMobileInput);
  const mobileInput = useGameStore(state => state.mobileInput);
  
  const [isPaused, setIsPaused] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showTutorial, setShowTutorial] = useState(true);
  const [isTouchDevice, setIsTouchDevice] = useState(false);


  useEffect(() => {
    // Detect touch device
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);

    const handlePointerLockChange = () => {
      const locked = !!document.pointerLockElement;
      setIsPaused(!locked);
      if (locked) setShowOptions(false);
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
    const canvas = document.querySelector('canvas');
    if (canvas) canvas.requestPointerLock();
  };

  const handleQuit = () => {
    if (document.pointerLockElement) document.exitPointerLock();
    setGameState('MENU');
  };

  const respawn = useGameStore(state => state.respawn);

  const handleRespawn = () => {
    respawn();
  };

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
                <div className="control-row"><span className="key">SHIFT</span> SPRINT</div>
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

      {/* Main HUD Stats */}
      <div className={`hud ${!isPaused ? 'visible' : ''}`} style={{ opacity: isPaused ? 0.2 : 1.0 }}>
        <div className="status-item">
          <div className="status-label">CHARACTER</div>
          <div className="status-value">{selectedCharacter}</div>
        </div>
        <div className="status-item">
          <div className="status-label">HEALTH</div>
          <div className="health-bar-bg">
            <div 
              className="health-bar-fill" 
              style={{ width: `${playerHealth}%`, background: playerHealth > 20 ? 'linear-gradient(90deg, #00ff88, #00ffcc)' : 'red' }}
            ></div>
          </div>
        </div>
      </div>

      {/* Crosshair */}
      {!isPaused && !isTouchDevice && (
        <div className="crosshair" />
      )}

      {/* Mobile Input UI */}
      {isTouchDevice && !isPaused && (
        <>
          <Joystick />
          <div className="mobile-action-buttons">
            <button 
              className="mobile-btn jump-btn" 
              onTouchStart={() => setMobileInput({ jump: true })}
              onTouchEnd={() => setMobileInput({ jump: false })}
            >JUMP</button>
            <button 
              className={`mobile-btn sprint-btn ${mobileInput.sprint ? 'active' : ''}`}
              onTouchStart={(e) => {
                e.preventDefault();
                setMobileInput({ sprint: !mobileInput.sprint });
              }}
            >SPRINT</button>
          </div>
        </>
      )}

      {/* Pause Menu Overlay */}
      {isPaused && (
        <div className="menu-overlay">
          <div className="menu-content" style={{ pointerEvents: 'auto' }}>
            {showOptions ? (
              <Options onBack={() => setShowOptions(false)} />
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
          style={{ position: 'absolute', inset: 0, zIndex: 10 }}
        />
      )}
    </div>
  );
}

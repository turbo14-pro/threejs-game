import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../store/useGameStore';
import Joystick from './Joystick.jsx';
import CameraJoystick from './CameraJoystick.jsx';
import Options from './Options.jsx';
import LatencyGraph from './LatencyGraph.jsx';

export default function HUD() {
  const matchPhase = useGameStore(state => state.game.phase);
  const countdown = useGameStore(state => state.game.countdown);
  const setGameState = useGameStore(state => state.setGameState);
  const setMobileInput = useGameStore(state => state.setMobileInput);
  const mobileInput = useGameStore(state => state.mobileInput);
  
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
    // We can use a custom action here if we want, but for now we'll just reset health
    useGameStore.getState().damagePlayer(-100); 
    useGameStore.getState().triggerWorldReset();
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

      {/* Leaderboard (Top 4) */}
      {!isPaused && (
        <>
          <div className="leaderboard">
            {[1,2,3,4].map(rank => (
              <div key={rank} className="leader-card">
                <div className="leader-icon">{rank === 1 ? '🥇' : rank}</div>
                <div className="leader-info">
                  <div className="leader-name">{rank === 1 ? 'PLAYER' : 'CPU BOT'}</div>
                  <div className="leader-kills">{rank === 1 ? '0' : Math.floor(Math.random() * 5)} KILLS</div>
                </div>
              </div>
            ))}
          </div>
          <LatencyGraph />
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
    </div>
  );
}

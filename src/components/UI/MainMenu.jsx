import React, { useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import Options from './Options.jsx';

export default function MainMenu() {
  const setGameState = useGameStore(state => state.setGameState);
  
  const [page, setPage] = useState('START'); // 'START' | 'OPTIONS'

  const handleStartGame = () => {
    setGameState('PLAYING');
    
    // Capture the mouse to enter the game instantly
    setTimeout(() => {
      const canvas = document.querySelector('canvas');
      if (canvas) canvas.requestPointerLock();
    }, 100);
  };

  return (
    <div className="menu-overlay">
      <div className="menu-content">
        
        {page === 'START' && (
          <>
            <h1>FOOD FRENZY</h1>
            <div className="menu-stack">
              <button 
                className="char-btn main-btn"
                onClick={handleStartGame}
              >
                <span className="btn-name">START GAME</span>
              </button>
              <button 
                className="char-btn main-btn"
                onClick={() => setPage('OPTIONS')}
              >
                <span className="btn-name">OPTIONS</span>
              </button>
              <a 
                href="https://docs.google.com/forms/d/e/1FAIpQLSeXA_Tpz1alvdX2xH4Bxw5RzAW-HspzlIdOOWc_RkE65Y3NhA/viewform?usp=header" 
                target="_blank" 
                className="char-btn survey-btn main-btn"
                rel="noreferrer"
              >
                <span className="btn-name">SURVEY</span>
              </a>
            </div>
          </>
        )}

        {page === 'OPTIONS' && (
          <Options onBack={() => setPage('START')} />
        )}

      </div>
    </div>
  );
}

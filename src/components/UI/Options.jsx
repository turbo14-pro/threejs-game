import React from 'react';
import { useGameStore } from '../../store/useGameStore';

export default function Options({ onBack }) {
  const settings = useGameStore(state => state.settings);
  const setSetting = useGameStore(state => state.setSetting);

  const toggleSetting = (key) => {
    setSetting(key, !settings[key]);
  };

  return (
    <div className="options-container">
      <h1>OPTIONS</h1>
      <div className="options-list">
        <div className="option-item" style={{ cursor: 'default' }}>
          <div className="option-info">
            <span className="option-name">Shadow Quality</span>
            <span className="option-desc">Balance performance and visual fidelity</span>
          </div>
          <select 
            className="premium-select" 
            value={settings.shadowQuality || 'Medium'} 
            onChange={(e) => setSetting('shadowQuality', e.target.value)}
          >
            <option value="Low">Low - Fast</option>
            <option value="Medium">Medium - Balanced</option>
            <option value="High">High - Cinematic</option>
          </select>
        </div>

        <div className="option-item" onClick={() => toggleSetting('bloom')}>
          <div className="option-info">
            <span className="option-name">Bloom Effect</span>
            <span className="option-desc">Cinematic glow for bright lights</span>
          </div>
          <div className={`premium-toggle ${settings.bloom ? 'active' : ''}`}>
            <div className="toggle-knob" />
          </div>
        </div>
        
        <div className="option-item" onClick={() => toggleSetting('fxaa')}>
          <div className="option-info">
            <span className="option-name">Anti-Aliasing</span>
            <span className="option-desc">Smoother edges (Performance friendly)</span>
          </div>
          <div className={`premium-toggle ${settings.fxaa ? 'active' : ''}`}>
            <div className="toggle-knob" />
          </div>
        </div>

        <div className="option-item" onClick={() => toggleSetting('vignette')}>
          <div className="option-info">
            <span className="option-name">Vignette</span>
            <span className="option-desc">Subtle darkening of the screen corners</span>
          </div>
          <div className={`premium-toggle ${settings.vignette ? 'active' : ''}`}>
            <div className="toggle-knob" />
          </div>
        </div>

        <div className="option-item" onClick={() => toggleSetting('grain')}>
          <div className="option-info">
            <span className="option-name">Film Grain</span>
            <span className="option-desc">Retro cinematic noise effect</span>
          </div>
          <div className={`premium-toggle ${settings.grain ? 'active' : ''}`}>
            <div className="toggle-knob" />
          </div>
        </div>
      </div>

      <button className="char-btn back-btn" onClick={onBack} style={{ marginTop: '2rem', padding: '1rem 3rem' }}>
        <span className="btn-name" style={{ fontSize: '0.9rem' }}>SAVE & BACK</span>
      </button>

      <div className="options-footer">
        DEVICE PIXEL RATIO: {settings.pixelRatio.toFixed(2)}
      </div>
    </div>

  );
}

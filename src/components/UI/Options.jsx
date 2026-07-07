import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../store/useGameStore';

export default function Options({ onBack }) {
  const settings = useGameStore(state => state.settings);
  const performancePreset = useGameStore(state => state.performancePreset);
  const setSetting = useGameStore(state => state.setSetting);
  const setPerformancePreset = useGameStore(state => state.setPerformancePreset);

  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Auto-expand advanced settings if Custom is selected
  useEffect(() => {
    if (performancePreset === 'Custom') {
      setAdvancedOpen(true);
    }
  }, [performancePreset]);

  const toggleSetting = (key) => {
    setSetting(key, !settings[key]);
  };

  return (
    <div className="options-container">
      <h1>OPTIONS</h1>
      
      <div className="options-list">
        {/* MAIN PRESET DROPDOWN */}
        <div className="option-item preset-item" style={{ cursor: 'default', background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="option-info">
            <span className="option-name" style={{ fontSize: '1.2rem', color: '#fff' }}>Performance Preset</span>
            <span className="option-desc">Quickly adjust all graphics settings</span>
          </div>
          <select 
            className="premium-select" 
            value={performancePreset} 
            onChange={(e) => setPerformancePreset(e.target.value)}
            style={{ minWidth: '180px' }}
          >
            <option value="Lowest">Lowest</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Ultra">Ultra</option>
            <option value="Custom">Custom</option>
          </select>
        </div>

        {/* ADVANCED ACCORDION TRIGGER */}
        <div 
          className="advanced-trigger" 
          onClick={() => setAdvancedOpen(!advancedOpen)}
          style={{ 
            marginTop: '1rem', 
            textAlign: 'center', 
            cursor: 'pointer', 
            padding: '0.5rem', 
            opacity: 0.7,
            fontSize: '0.8rem',
            letterSpacing: '1px'
          }}
        >
          {advancedOpen ? '▼ HIDE ADVANCED SETTINGS' : '▶ SHOW ADVANCED SETTINGS'}
        </div>

        {advancedOpen && (
          <div className="advanced-options" style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
            
            {/* SHADOWS */}
            <div className="option-item">
              <div className="option-info">
                <span className="option-name">Shadow Quality</span>
              </div>
              <select 
                className="premium-select" 
                value={settings.shadowQuality || 'Medium'} 
                onChange={(e) => setSetting('shadowQuality', e.target.value)}
              >
                <option value="None">None</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Ultra">Ultra</option>
              </select>
            </div>

            {/* SKYBOX */}
            <div className="option-item" onClick={() => toggleSetting('skybox')}>
              <div className="option-info"><span className="option-name">Skybox</span></div>
              <div className={`premium-toggle ${settings.skybox ? 'active' : ''}`}><div className="toggle-knob" /></div>
            </div>

            {/* ANTIALIASING */}
            <div className="option-item">
              <div className="option-info">
                <span className="option-name">Antialiasing</span>
              </div>
              <select 
                className="premium-select" 
                value={settings.antialiasing || 'None'} 
                onChange={(e) => setSetting('antialiasing', e.target.value)}
              >
                <option value="None">None</option>
                <option value="FXAA">FXAA (Fast)</option>
                <option value="SMAA">SMAA (High)</option>
                <option value="TAA">TAA (Temporal)</option>
              </select>
            </div>

            {/* BLOOM */}
            <div className="option-item" onClick={() => toggleSetting('bloom')}>
              <div className="option-info"><span className="option-name">Bloom Effect</span></div>
              <div className={`premium-toggle ${settings.bloom ? 'active' : ''}`}><div className="toggle-knob" /></div>
            </div>

            {/* DEPTH OF FIELD */}
            <div className="option-item" onClick={() => toggleSetting('depthOfField')}>
              <div className="option-info"><span className="option-name">Depth of Field</span></div>
              <div className={`premium-toggle ${settings.depthOfField ? 'active' : ''}`}><div className="toggle-knob" /></div>
            </div>

            {/* SSAO */}
            <div className="option-item" onClick={() => toggleSetting('ssao')}>
              <div className="option-info"><span className="option-name">SSAO (Corners)</span></div>
              <div className={`premium-toggle ${settings.ssao ? 'active' : ''}`}><div className="toggle-knob" /></div>
            </div>

            {/* LIGHT RAYS */}
            <div className="option-item" onClick={() => toggleSetting('lightRays')}>
              <div className="option-info"><span className="option-name">Light Rays</span></div>
              <div className={`premium-toggle ${settings.lightRays ? 'active' : ''}`}><div className="toggle-knob" /></div>
            </div>

            {/* SHOCKWAVE */}
            <div className="option-item" onClick={() => toggleSetting('shockwave')}>
              <div className="option-info"><span className="option-name">Impact Ripples</span></div>
              <div className={`premium-toggle ${settings.shockwave ? 'active' : ''}`}><div className="toggle-knob" /></div>
            </div>

            {/* VIGNETTE */}
            <div className="option-item" onClick={() => toggleSetting('vignette')}>
              <div className="option-info"><span className="option-name">Vignette</span></div>
              <div className={`premium-toggle ${settings.vignette ? 'active' : ''}`}><div className="toggle-knob" /></div>
            </div>

            {/* GRAIN */}
            <div className="option-item" onClick={() => toggleSetting('grain')}>
              <div className="option-info"><span className="option-name">Film Grain</span></div>
              <div className={`premium-toggle ${settings.grain ? 'active' : ''}`}><div className="toggle-knob" /></div>
            </div>

            {/* PHYSICS DEBUG */}
            <div className="option-item" onClick={() => toggleSetting('physicsDebug')}>
              <div className="option-info">
                <span className="option-name">Physics Debug</span>
                <span className="option-desc">Show collision wireframes</span>
              </div>
              <div className={`premium-toggle ${settings.physicsDebug ? 'active' : ''}`}><div className="toggle-knob" /></div>
            </div>

          </div>
        )}
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

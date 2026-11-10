import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { setDebugEnabled, isDebugEnabled } from '../../utils/debugLog';

export default function Options({ onBack }) {
  const settings = useGameStore(state => state.settings);
  const performancePreset = useGameStore(state => state.performancePreset);
  const setSetting = useGameStore(state => state.setSetting);
  const setPerformancePreset = useGameStore(state => state.setPerformancePreset);

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [debugEnabled, setDebugEnabledState] = useState(isDebugEnabled);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-expand advanced settings if Custom is selected
  useEffect(() => {
    if (performancePreset === 'Custom') {
      setAdvancedOpen(true);
    }
  }, [performancePreset]);

  const toggleSetting = (key) => {
    setSetting(key, !settings[key]);
  };

  const toggleDebug = () => {
    const enabled = !isDebugEnabled();
    setDebugEnabled(enabled);
    setDebugEnabledState(enabled);
  };

  return (
    <div className="options-container">
      <h1>OPTIONS</h1>
      
      <div className="options-list">
        {/* MAIN PRESET DROPDOWN */}
        <div className="option-item preset-item">
          <div className="option-info">
            <label htmlFor="performance-preset" className="option-name-label">Performance Preset</label>
            <span className="option-desc">Quickly adjust all graphics settings</span>
          </div>
          <select 
            id="performance-preset"
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
        >
          {advancedOpen ? '▼ HIDE ADVANCED SETTINGS' : '▶ SHOW ADVANCED SETTINGS'}
        </div>

        {advancedOpen && (
          <div className="advanced-options">
            
            {/* SHADOWS */}
            <div className="option-item">
              <div className="option-info">
                <label htmlFor="shadow-quality" className="option-name">Shadow Quality</label>
              </div>
              <select 
                id="shadow-quality"
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
              <button
                role="switch"
                aria-checked={settings.skybox}
                aria-label="Skybox"
                className={`premium-toggle touch-target ${settings.skybox ? 'active' : ''}`}
                onClick={() => toggleSetting('skybox')}
              >
                <div className="toggle-knob" />
              </button>
            </div>

            {/* ANTIALIASING */}
            <div className="option-item">
              <div className="option-info">
                <label htmlFor="antialiasing" className="option-name">Antialiasing</label>
              </div>
              <select 
                id="antialiasing"
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
              <button
                role="switch"
                aria-checked={settings.bloom}
                aria-label="Bloom Effect"
                className={`premium-toggle touch-target ${settings.bloom ? 'active' : ''}`}
                onClick={() => toggleSetting('bloom')}
              >
                <div className="toggle-knob" />
              </button>
            </div>

            {/* DEPTH OF FIELD */}
            <div className="option-item" onClick={() => toggleSetting('depthOfField')}>
              <div className="option-info"><span className="option-name">Depth of Field</span></div>
              <button
                role="switch"
                aria-checked={settings.depthOfField}
                aria-label="Depth of Field"
                className={`premium-toggle touch-target ${settings.depthOfField ? 'active' : ''}`}
                onClick={() => toggleSetting('depthOfField')}
              >
                <div className="toggle-knob" />
              </button>
            </div>

            {/* SSAO */}
            <div className="option-item" onClick={() => toggleSetting('ssao')}>
              <div className="option-info"><span className="option-name">SSAO (Corners)</span></div>
              <button
                role="switch"
                aria-checked={settings.ssao}
                aria-label="SSAO (Corners)"
                className={`premium-toggle touch-target ${settings.ssao ? 'active' : ''}`}
                onClick={() => toggleSetting('ssao')}
              >
                <div className="toggle-knob" />
              </button>
            </div>

            {/* LIGHT RAYS */}
            <div className="option-item" onClick={() => toggleSetting('lightRays')}>
              <div className="option-info"><span className="option-name">Light Rays</span></div>
              <button
                role="switch"
                aria-checked={settings.lightRays}
                aria-label="Light Rays"
                className={`premium-toggle touch-target ${settings.lightRays ? 'active' : ''}`}
                onClick={() => toggleSetting('lightRays')}
              >
                <div className="toggle-knob" />
              </button>
            </div>

            {/* SHOCKWAVE */}
            <div className="option-item" onClick={() => toggleSetting('shockwave')}>
              <div className="option-info"><span className="option-name">Impact Ripples</span></div>
              <button
                role="switch"
                aria-checked={settings.shockwave}
                aria-label="Impact Ripples"
                className={`premium-toggle touch-target ${settings.shockwave ? 'active' : ''}`}
                onClick={() => toggleSetting('shockwave')}
              >
                <div className="toggle-knob" />
              </button>
            </div>

            {/* VIGNETTE */}
            <div className="option-item" onClick={() => toggleSetting('vignette')}>
              <div className="option-info"><span className="option-name">Vignette</span></div>
              <button
                role="switch"
                aria-checked={settings.vignette}
                aria-label="Vignette"
                className={`premium-toggle touch-target ${settings.vignette ? 'active' : ''}`}
                onClick={() => toggleSetting('vignette')}
              >
                <div className="toggle-knob" />
              </button>
            </div>

            {/* GRAIN */}
            <div className="option-item" onClick={() => toggleSetting('grain')}>
              <div className="option-info"><span className="option-name">Film Grain</span></div>
              <button
                role="switch"
                aria-checked={settings.grain}
                aria-label="Film Grain"
                className={`premium-toggle touch-target ${settings.grain ? 'active' : ''}`}
                onClick={() => toggleSetting('grain')}
              >
                <div className="toggle-knob" />
              </button>
            </div>

            {/* PHYSICS DEBUG */}
            <div className="option-item" onClick={() => toggleSetting('physicsDebug')}>
              <div className="option-info">
                <span className="option-name">Physics Debug</span>
                <span className="option-desc">Show collision wireframes</span>
              </div>
              <button
                role="switch"
                aria-checked={settings.physicsDebug}
                aria-label="Physics Debug"
                className={`premium-toggle touch-target ${settings.physicsDebug ? 'active' : ''}`}
                onClick={() => toggleSetting('physicsDebug')}
              >
                <div className="toggle-knob" />
              </button>
            </div>

            {/* DEBUG MODE */}
            <div className="option-item" onClick={toggleDebug}>
              <div className="option-info">
                <span className="option-name">Debug Mode</span>
                <span className="option-desc">Enable global debug logging</span>
              </div>
              <button
                role="switch"
                aria-checked={debugEnabled}
                aria-label="Debug Mode"
                className={`premium-toggle touch-target ${debugEnabled ? 'active' : ''}`}
                onClick={toggleDebug}
              >
                <div className="toggle-knob" />
              </button>
            </div>

          </div>
        )}
      </div>

      <button className="char-btn back-btn" onClick={onBack} disabled={isSaving}>
        <span className="btn-name btn-name-sm">{isSaving ? 'SAVING...' : 'SAVE & BACK'}</span>
      </button>

      <div className="options-footer">
        DEVICE PIXEL RATIO: {settings.pixelRatio.toFixed(2)}
      </div>
    </div>
  );
}

import React, {useState, useEffect} from "react";
import {useGameStore} from "../../store/useGameStore";
import {setDebugEnabled, isDebugEnabled} from "../../utils/debugLog";
import "./Menu.css";

export default function Options({onBack}) {
    const settings = useGameStore((state) => state.settings);
    const performancePreset = useGameStore((state) => state.performancePreset);
    const setSetting = useGameStore((state) => state.setSetting);
    const setPerformancePreset = useGameStore((state) => state.setPerformancePreset);
    const masterVolume = useGameStore((state) => state.audio.masterVolume);
    const setMasterVolume = useGameStore((state) => state.setMasterVolume);
    const ambientVolume = useGameStore((state) => state.audio.ambientVolume);
    const setAmbientVolume = useGameStore((state) => state.setAmbientVolume);
    const sfxVolume = useGameStore((state) => state.audio.sfxVolume);
    const setSfxVolume = useGameStore((state) => state.setSfxVolume);
    const musicVolume = useGameStore((state) => state.audio.musicVolume);
    const setMusicVolume = useGameStore((state) => state.setMusicVolume);

    const [submenu, setSubmenu] = useState("graphics"); // 'graphics' | 'controls' | 'audio'
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [debugEnabled, setDebugEnabledState] = useState(isDebugEnabled);
    const [isSaving] = useState(false); // reserved for future async save flows

    // Auto-expand advanced settings if Custom is selected
    useEffect(() => {
        if (performancePreset === "Custom") {
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

    const graphicsContent = (
        <>
            {/* MAIN PRESET DROPDOWN */}
            <div className="option-item preset-item">
                <div className="option-info">
                    <label htmlFor="performance-preset" className="option-name-label">
                        Performance Preset
                    </label>
                    <span className="option-desc">Quickly adjust all graphics settings</span>
                </div>
                <select
                    id="performance-preset"
                    className="premium-select"
                    value={performancePreset}
                    onChange={(e) => setPerformancePreset(e.target.value)}
                    style={{minWidth: "180px"}}>
                    <option value="Lowest">Lowest</option>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Ultra">Ultra</option>
                    <option value="Custom">Custom</option>
                </select>
            </div>

            {/* ADVANCED ACCORDION TRIGGER */}
            <div className="advanced-trigger" onClick={() => setAdvancedOpen(!advancedOpen)}>
                {advancedOpen ? "▼ HIDE ADVANCED SETTINGS" : "▶ SHOW ADVANCED SETTINGS"}
            </div>

            {advancedOpen && (
                <div className="advanced-options">
                    {/* SHADOWS */}
                    <div className="option-item">
                        <div className="option-info">
                            <label htmlFor="shadow-quality" className="option-name">
                                Shadow Quality
                            </label>
                        </div>
                        <select
                            id="shadow-quality"
                            className="premium-select"
                            value={settings.shadowQuality || "Medium"}
                            onChange={(e) => setSetting("shadowQuality", e.target.value)}>
                            <option value="None">None</option>
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Ultra">Ultra</option>
                        </select>
                    </div>

                    {/* SKYBOX */}
                    <div className="option-item" onClick={() => toggleSetting("skybox")}>
                        <div className="option-info">
                            <span className="option-name">Skybox</span>
                        </div>
                        <button
                            role="switch"
                            aria-checked={settings.skybox}
                            aria-label="Skybox"
                            className={`premium-toggle touch-target ${settings.skybox ? "active" : ""}`}
                            onClick={() => toggleSetting("skybox")}>
                            <div className="toggle-knob" />
                        </button>
                    </div>

                    {/* ANTIALIASING */}
                    <div className="option-item">
                        <div className="option-info">
                            <label htmlFor="antialiasing" className="option-name">
                                Antialiasing
                            </label>
                        </div>
                        <select
                            id="antialiasing"
                            className="premium-select"
                            value={settings.antialiasing || "None"}
                            onChange={(e) => setSetting("antialiasing", e.target.value)}>
                            <option value="None">None</option>
                            <option value="FXAA">FXAA (Fast)</option>
                            <option value="SMAA">SMAA (High)</option>
                            <option value="TAA">TAA (Temporal)</option>
                        </select>
                    </div>

                    {/* BLOOM */}
                    <div className="option-item" onClick={() => toggleSetting("bloom")}>
                        <div className="option-info">
                            <span className="option-name">Bloom Effect</span>
                        </div>
                        <button
                            role="switch"
                            aria-checked={settings.bloom}
                            aria-label="Bloom Effect"
                            className={`premium-toggle touch-target ${settings.bloom ? "active" : ""}`}
                            onClick={() => toggleSetting("bloom")}>
                            <div className="toggle-knob" />
                        </button>
                    </div>

                    {/* DEPTH OF FIELD */}
                    <div className="option-item" onClick={() => toggleSetting("depthOfField")}>
                        <div className="option-info">
                            <span className="option-name">Depth of Field</span>
                        </div>
                        <button
                            role="switch"
                            aria-checked={settings.depthOfField}
                            aria-label="Depth of Field"
                            className={`premium-toggle touch-target ${settings.depthOfField ? "active" : ""}`}
                            onClick={() => toggleSetting("depthOfField")}>
                            <div className="toggle-knob" />
                        </button>
                    </div>

                    {/* TILT SHIFT */}
                    <div className="option-item" onClick={() => toggleSetting("tiltShift")}>
                        <div className="option-info">
                            <span className="option-name">Tilt Shift</span>
                        </div>
                        <button
                            role="switch"
                            aria-checked={settings.tiltShift}
                            aria-label="Tilt Shift"
                            className={`premium-toggle touch-target ${settings.tiltShift ? "active" : ""}`}
                            onClick={() => toggleSetting("tiltShift")}>
                            <div className="toggle-knob" />
                        </button>
                    </div>

                    {/* SSAO */}
                    <div className="option-item" onClick={() => toggleSetting("ssao")}>
                        <div className="option-info">
                            <span className="option-name">SSAO (Corners)</span>
                        </div>
                        <button
                            role="switch"
                            aria-checked={settings.ssao}
                            aria-label="SSAO (Corners)"
                            className={`premium-toggle touch-target ${settings.ssao ? "active" : ""}`}
                            onClick={() => toggleSetting("ssao")}>
                            <div className="toggle-knob" />
                        </button>
                    </div>

                    {/* LIGHT RAYS */}
                    <div className="option-item" onClick={() => toggleSetting("lightRays")}>
                        <div className="option-info">
                            <span className="option-name">Light Rays</span>
                        </div>
                        <button
                            role="switch"
                            aria-checked={settings.lightRays}
                            aria-label="Light Rays"
                            className={`premium-toggle touch-target ${settings.lightRays ? "active" : ""}`}
                            onClick={() => toggleSetting("lightRays")}>
                            <div className="toggle-knob" />
                        </button>
                    </div>

                    {/* SHOCKWAVE */}
                    <div className="option-item" onClick={() => toggleSetting("shockwave")}>
                        <div className="option-info">
                            <span className="option-name">Impact Ripples</span>
                        </div>
                        <button
                            role="switch"
                            aria-checked={settings.shockwave}
                            aria-label="Impact Ripples"
                            className={`premium-toggle touch-target ${settings.shockwave ? "active" : ""}`}
                            onClick={() => toggleSetting("shockwave")}>
                            <div className="toggle-knob" />
                        </button>
                    </div>

                    {/* VIGNETTE */}
                    <div className="option-item" onClick={() => toggleSetting("vignette")}>
                        <div className="option-info">
                            <span className="option-name">Vignette</span>
                        </div>
                        <button
                            role="switch"
                            aria-checked={settings.vignette}
                            aria-label="Vignette"
                            className={`premium-toggle touch-target ${settings.vignette ? "active" : ""}`}
                            onClick={() => toggleSetting("vignette")}>
                            <div className="toggle-knob" />
                        </button>
                    </div>

                    {/* GRAIN */}
                    <div className="option-item" onClick={() => toggleSetting("grain")}>
                        <div className="option-info">
                            <span className="option-name">Film Grain</span>
                        </div>
                        <button
                            role="switch"
                            aria-checked={settings.grain}
                            aria-label="Film Grain"
                            className={`premium-toggle touch-target ${settings.grain ? "active" : ""}`}
                            onClick={() => toggleSetting("grain")}>
                            <div className="toggle-knob" />
                        </button>
                    </div>

                    {/* GLITCH */}
                    <div className="option-item" onClick={() => toggleSetting("glitch")}>
                        <div className="option-info">
                            <span className="option-name">Glitch</span>
                        </div>
                        <button
                            role="switch"
                            aria-checked={settings.glitch}
                            aria-label="Glitch"
                            className={`premium-toggle touch-target ${settings.glitch ? "active" : ""}`}
                            onClick={() => toggleSetting("glitch")}>
                            <div className="toggle-knob" />
                        </button>
                    </div>

                    {/* DISPLAY FPS */}
                    <div className="option-item" onClick={() => toggleSetting("displayFps")}>
                        <div className="option-info">
                            <span className="option-name">Display FPS</span>
                            <span className="option-desc">Show FPS, latency, players, desync</span>
                        </div>
                        <button
                            role="switch"
                            aria-checked={settings.displayFps}
                            aria-label="Display FPS"
                            className={`premium-toggle touch-target ${settings.displayFps ? "active" : ""}`}
                            onClick={() => toggleSetting("displayFps")}>
                            <div className="toggle-knob" />
                        </button>
                    </div>

                    {/* PHYSICS DEBUG */}
                    <div className="option-item" onClick={() => toggleSetting("physicsDebug")}>
                        <div className="option-info">
                            <span className="option-name">Physics Debug</span>
                            <span className="option-desc">Show collision wireframes</span>
                        </div>
                        <button
                            role="switch"
                            aria-checked={settings.physicsDebug}
                            aria-label="Physics Debug"
                            className={`premium-toggle touch-target ${settings.physicsDebug ? "active" : ""}`}
                            onClick={() => toggleSetting("physicsDebug")}>
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
                            className={`premium-toggle touch-target ${debugEnabled ? "active" : ""}`}
                            onClick={toggleDebug}>
                            <div className="toggle-knob" />
                        </button>
                    </div>
                </div>
            )}
        </>
    );

    const controlsContent = (
        <div className="option-item preset-item">
            <div className="option-info">
                <span className="option-name-label">Control Key Bindings</span>
                <span className="option-desc">Keyboard and gamepad controls</span>
            </div>
            <div
                className="controls-grid"
                style={{marginTop: "1rem", textAlign: "left", maxWidth: "400px", margin: "1rem auto"}}>
                <div className="control-row">
                    <span className="key">WASD</span> MOVE
                </div>
                <div className="control-row">
                    <span className="key">SHIFT</span> WALK
                </div>
                <div className="control-row">
                    <span className="key">C</span> SLIDE
                </div>
                <div className="control-row">
                    <span className="key">SPACE</span> JUMP
                </div>
                <div className="control-row">
                    <span className="key">MOUSE</span> LOOK
                </div>
                <div className="control-row">
                    <span className="key">ESC</span> PAUSE
                </div>
            </div>
        </div>
    );

    const audioContent = (
        <>
            <div className="option-item preset-item">
                <div className="option-info">
                    <label htmlFor="volume-master" className="option-name-label">
                        Master Volume
                    </label>
                </div>
                <input
                    id="volume-master"
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={masterVolume}
                    onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
                    className="volume-slider"
                />
            </div>
            <div className="option-item preset-item">
                <div className="option-info">
                    <label htmlFor="volume-music" className="option-name-label">
                        Music Volume
                    </label>
                    <span className="option-desc">
                        Background music — wired to store `audio.musicVolume`, persisted across reloads.
                    </span>
                </div>
                <input
                    id="volume-music"
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={musicVolume}
                    onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
                    className="volume-slider"
                />
            </div>
            <div className="option-item preset-item">
                <div className="option-info">
                    <label htmlFor="volume-sfx" className="option-name-label">
                        SFX Volume
                    </label>
                    <span className="option-desc">Positional one-shots (hits, jumps, powerup pickup)</span>
                </div>
                <input
                    id="volume-sfx"
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={sfxVolume}
                    onChange={(e) => setSfxVolume(parseFloat(e.target.value))}
                    className="volume-slider"
                />
            </div>
            <div className="option-item preset-item">
                <div className="option-info">
                    <label htmlFor="volume-ambient" className="option-name-label">
                        Ambient Volume
                    </label>
                    <span className="option-desc">Background ambience bed</span>
                </div>
                <input
                    id="volume-ambient"
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={ambientVolume}
                    onChange={(e) => setAmbientVolume(parseFloat(e.target.value))}
                    className="volume-slider"
                />
            </div>
        </>
    );

    return (
        <div className="options-container">
            <h1 className="menu__title">OPTIONS</h1>

            {/* SUBMENU NAVIGATION */}
            <div className="submenu-nav">
                <button
                    className={`submenu-btn ${submenu === "graphics" ? "active" : ""}`}
                    onClick={() => setSubmenu("graphics")}>
                    GRAPHICS
                </button>
                <button
                    className={`submenu-btn ${submenu === "controls" ? "active" : ""}`}
                    onClick={() => setSubmenu("controls")}>
                    CONTROLS
                </button>
                <button
                    className={`submenu-btn ${submenu === "audio" ? "active" : ""}`}
                    onClick={() => setSubmenu("audio")}>
                    AUDIO
                </button>
            </div>

            <div className="options-list">
                {submenu === "graphics" && graphicsContent}
                {submenu === "controls" && controlsContent}
                {submenu === "audio" && audioContent}
            </div>

            <button className="char-btn back-btn" onClick={onBack} disabled={isSaving}>
                <span className="btn-name btn-name-sm">{isSaving ? "SAVING..." : "SAVE & BACK"}</span>
            </button>

            <div className="options-footer">DEVICE PIXEL RATIO: {settings.pixelRatio.toFixed(2)}</div>
        </div>
    );
}

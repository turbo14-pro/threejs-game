# Changelog

All notable changes to Food Frenzy will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-13

### Added
- Initial release of Food Frenzy
- 3D multiplayer arena gameplay with food-themed characters
- Real-time multiplayer using custom WebSocket binary protocol (msgpackr)
- Physics-based movement with Rapier 3D physics engine
- Character skins and animations (Avo, Burger, Donut, Pizza, Taco)
- Power-up system (Jump, Speed, Dash, Slide with Bronze/Silver/Gold/Diamond rarities)
- Bot AI for solo play (3 bots on normal difficulty)
- Dynamic music system with crossfade between tracks
- Ambient audio with reverb zones (outside/inside/edge)
- Performance presets (Lowest, Low, Medium, High, Ultra, Custom)
- PWA support for offline play and installation
- Mobile touch controls with virtual joysticks
- Visual effects: bloom, vignette, grain, SSAO, light rays, shockwaves, depth of field
- Glass surface UI components with liquid glass effect
- Comprehensive test suite (unit + e2e)

### Technical
- React 19 with React Three Fiber
- Vite build system with PWA plugin
- Zustand for state management
- Vitest for unit testing
- Playwright for e2e testing
- ESLint for code quality
- WebSocket server with physics worker thread (30Hz simulation, 20Hz snapshots)
- Entity culling with interest radius (200 units)
- Change detection for efficient network updates
- Input sequence validation for anti-cheat
- Obstacle system with cereal box colliders

### Fixed
- Build configuration for glass-surface components
- SoundManager music volume multiplier (0.15 base)
- Reverb wet gain default (0.25)
- Unit test failures in SoundManager lifecycle tests
- Server index.js removal test (now correctly validates thin wrapper)

## [Unreleased]

### Planned
- Leaderboard system
- More character skins
- Additional arenas/levels
- Spectator mode
- Replay system
- Clan/team support
- Custom game modes
- Voice chat integration
- Mobile performance optimizations
- Accessibility improvements (screen reader support, color blind modes)

---

## Version History

| Version | Date | Notes |
|---------|------|-------|
| 1.0.0 | 2026-11-13 | Initial release |
# Food Frenzy

A 3D multiplayer food fight game built with React, Three.js, and Rapier physics.

## 🎮 Play Now

[Play on itch.io](https://your-username.itch.io/food-frenzy)

## 🎯 Game Overview

Food Frenzy is a fast-paced 3D multiplayer arena game where players battle as food-themed characters. Dodge, dash, and slide your way to victory in a chaotic food fight!

### Features

- **Real-time Multiplayer**: Battle against other players in real-time using WebSocket binary protocol
- **Physics-based Movement**: Powered by Rapier physics engine for realistic collisions and movement
- **3D Graphics**: Built with Three.js and React Three Fiber for stunning visuals
- **Cross-platform**: Play in any modern browser (desktop and mobile)
- **PWA Support**: Install as a Progressive Web App for offline play
- **Bots**: Practice against AI opponents when playing solo

## 🎮 Controls

### Keyboard (Desktop)
| Key | Action |
|-----|--------|
| WASD / Arrow Keys | Move |
| Space | Jump |
| Shift | Walk (slow) |
| C | Slide |
| Q | Dash |
| Escape | Pause Menu |

### Touch (Mobile)
- **Left Joystick**: Move
- **Right Joystick**: Look around
- **Jump Button**: Jump
- **Slide Button**: Slide
- **Dash Button**: Dash

## 🛠️ Technical Stack

- **Frontend**: React 19, Three.js (via React Three Fiber)
- **Physics**: Rapier 3D (via @react-three/rapier)
- **Multiplayer**: Custom WebSocket binary protocol (msgpackr)
- **State Management**: Zustand
- **Build Tool**: Vite
- **Testing**: Vitest (unit), Playwright (e2e)
- **PWA**: Workbox (via vite-plugin-pwa)

## 🚀 Development

### Prerequisites
- Node.js 18+
- npm 9+

### Installation
```bash
npm install
```

### Running Locally
You need two terminals:

**Terminal 1 - Frontend:**
```bash
npm run dev
```
Opens at http://localhost:5173

**Terminal 2 - Game Server:**
```bash
npm run server
```
Runs WebSocket server on port 9208

### Testing
```bash
# Unit tests
npm run test

# E2E tests (requires server running)
npm run test:e2e

# Linting
npm run lint
```

### Building for Production
```bash
npm run build
```
Outputs to `dist/` folder, ready for deployment.

## 📦 Deployment

### itch.io
1. Run `npm run build`
2. Upload the `dist/` folder contents to itch.io
3. Set "Embed game" to "This file will be played in the browser"
4. Set index.html as the main file

### Custom Server
```bash
npm run deploy
```
Requires FTP credentials in `.env` file (see `.env.example`)

## 🔧 Configuration

### Environment Variables
Copy `.env.example` to `.env` and configure:
- `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD` - For deployment
- `VITE_SERVER_URL_PRODUCTION` - Production WebSocket server URL

### Performance Presets
The game includes performance presets (Lowest, Low, Medium, High, Ultra, Custom) accessible from the Options menu.

## 🎨 Assets

All 3D models, textures, and audio are in the `public/` folder:
- `public/models/` - GLTF/GLB models
- `public/textures/` - Image textures
- `public/audio/` - Sound effects and music
- `public/skins/` - Character skins and animations

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 🐛 Known Issues

- Visual regression tests need baseline images on first run
- Mobile touch controls may need calibration on some devices
- WebSocket connection requires HTTPS in production (use WSS)

## 📞 Support

For issues and feature requests, please use the GitHub issue tracker.
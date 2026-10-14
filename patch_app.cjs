const fs = require('fs');
let f = fs.readFileSync('src/App.jsx', 'utf8');
// Add useGamepad import
f = f.replace("import NetworkStatus from './components/UI/NetworkStatus.jsx';", "import NetworkStatus from './components/UI/NetworkStatus.jsx';\nimport { useGamepad } from './hooks/useGamepad.js';");
// Add Start/menu handling inside the existing useEffect or add new one
f = f.replace('  const gameState = useGameStore(state => state.game.state);', '  const gameState = useGameStore(state => state.game.state);\n  const { poll, connectedRef } = useGamepad();');
// After the keyboard event listener useEffect, add gamepad listener
f = f.replace('  return () => {\n      window.removeEventListener(\'keydown\', handleKeyDown);\n    };', '  return () => {\n      window.removeEventListener(\'keydown\', handleKeyDown);\n    };\n  }, []);\n\n  useEffect(() => {\n    const handleGamepad = () => {\n      const gp = poll ? poll(0.016) : null;\n      if (!gp) return;\n      if (gp.edges[9]) { // Start button\n        const store = require(\'./store/useGameStore.js\').useGameStore;\n        // Can't easily call store here; instead dispatch via window event or direct import\n      }\n    };\n    const interval = setInterval(handleGamepad, 16);\n    return () => clearInterval(interval);\n  }, [poll]);');
fs.writeFileSync('src/App.jsx', f);
console.log('App updated');

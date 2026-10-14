const fs = require('fs');
let f = fs.readFileSync('src/components/Player/PlayerController.jsx', 'utf8');
// Add useGamepad import
if (!f.includes('useGamepad')) {
  f = f.replace("import { soundManager } from '../../utils/SoundManager';", "import { soundManager } from '../../utils/SoundManager';\nimport { useGamepad } from '../../hooks/useGamepad.js';");
}
// Add poll destructuring after mobileInput line
if (!f.includes('const { poll }')) {
  f = f.replace('  const mobileInput = useGameStore(state => state.mobileInput);', '  const mobileInput = useGameStore(state => state.mobileInput);\n  const { poll } = useGamepad();');
}
// Add gp polling + deadzone log inside useFrame after keys = getKeys()
const oldKeys = '    const keys = getKeys();';
const newKeys = `    const keys = getKeys();\n    const gp = poll ? poll(0.016) : null;\n    if (gp) {\n      const active = (Math.abs(gp.axes.lx) > 0.15 || Math.abs(gp.axes.ly) > 0.15 || Math.abs(gp.axes.rx) > 0.15 || Math.abs(gp.axes.ry) > 0.15 || Math.abs(gp.axes.rt) > 0.15 || gp.axes.rtPressed || gp.edges.length > 0 || gp.buttons.some(b => b.pressed));\n      if (active) console.log("[Gamepad] axes:", {lx: gp.axes.lx.toFixed(2), ly: gp.axes.ly.toFixed(2), rx: gp.axes.rx.toFixed(2), ry: gp.axes.ry.toFixed(2), rt: gp.axes.rt.toFixed(2), rtPressed: gp.axes.rtPressed}, "edges:", gp.edges, "buttons:", gp.buttons.map((b,i)=>b.pressed?i:null).filter(x=>x!==null));\n    }`;
if (!f.includes('const gp = poll')) f = f.replace(oldKeys, newKeys);
fs.writeFileSync('src/components/Player/PlayerController.jsx', f);
console.log('hook + poll + log added');

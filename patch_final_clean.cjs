const fs = require('fs');
let f = fs.readFileSync('src/components/Player/PlayerController.jsx', 'utf8');
// Fix stick: add + gp.axes.ly to moveZ line (keyboard stays backward-forward)
const oldLine = '      moveZ = (keys.backward ? 1 : 0) - (keys.forward ? 1 : 0) - (mobileInput.y || 0);';
const newLine = '      moveZ = (keys.backward ? 1 : 0) - (keys.forward ? 1 : 0) - (mobileInput.y || 0) + (gp ? gp.axes.ly : 0);';
if (!f.includes(newLine)) f = f.replace(oldLine, newLine);
// Add deadzone logging after gp = poll line
const oldPoll = '    const gp = poll ? poll(0.016) : null;';
const newPoll = `    const gp = poll ? poll(0.016) : null;\n    if (gp) {\n      const active = (Math.abs(gp.axes.lx) > 0.15 || Math.abs(gp.axes.ly) > 0.15 || Math.abs(gp.axes.rx) > 0.15 || Math.abs(gp.axes.ry) > 0.15 || Math.abs(gp.axes.rt) > 0.15 || gp.axes.rtPressed || gp.edges.length > 0 || gp.buttons.some(b => b.pressed));\n      if (active) console.log("[Gamepad] axes:", {lx: gp.axes.lx.toFixed(2), ly: gp.axes.ly.toFixed(2), rx: gp.axes.rx.toFixed(2), ry: gp.axes.ry.toFixed(2), rt: gp.axes.rt.toFixed(2), rtPressed: gp.axes.rtPressed}, "edges:", gp.edges, "buttons:", gp.buttons.map((b,i)=>b.pressed?i:null).filter(x=>x!==null));\n    }`;
if (!f.includes('const active =')) f = f.replace(oldPoll, newPoll);
fs.writeFileSync('src/components/Player/PlayerController.jsx', f);
console.log('restored + stick + deadzone log');

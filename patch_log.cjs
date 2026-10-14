const fs = require('fs');
let f = fs.readFileSync('src/components/Player/PlayerController.jsx', 'utf8');
f = f.replace('      moveZ = (keys.backward ? 1 : 0) - (keys.forward ? 1 : 0) - (mobileInput.y || 0) - (gp ? gp.axes.ly : 0);', '      moveZ = (keys.forward ? 1 : 0) - (keys.backward ? 1 : 0) - (mobileInput.y || 0) + (gp ? gp.axes.ly : 0);');
const logLine = '    if (gp) console.log("[Gamepad] axes:", {lx: gp.axes.lx.toFixed(2), ly: gp.axes.ly.toFixed(2), rx: gp.axes.rx.toFixed(2), ry: gp.axes.ry.toFixed(2), rt: gp.axes.rt.toFixed(2), rtPressed: gp.axes.rtPressed}, "edges:", gp.edges, "buttons:", gp.buttons.map((b,i)=>b.pressed?i:null).filter(x=>x!==null));';
f = f.replace('    const gp = poll ? poll(0.016) : null;', '    const gp = poll ? poll(0.016) : null;\n' + logLine);
fs.writeFileSync('src/components/Player/PlayerController.jsx', f);
console.log('done');

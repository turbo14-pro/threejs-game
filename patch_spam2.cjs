const fs = require('fs');
let f = fs.readFileSync('src/components/Player/PlayerController.jsx', 'utf8');
// Find the exact line and replace with deadzone version
f = f.replace(
  '    if (gp && (gp.axes.lx !== 0 || gp.axes.ly !== 0 || gp.axes.rx !== 0 || gp.axes.ry !== 0 || gp.axes.rt !== 0 || gp.axes.rtPressed || gp.edges.length > 0 || gp.buttons.some(b => b.pressed))) {',
  '    if (gp) {\n      const active = (Math.abs(gp.axes.lx) > 0.15 || Math.abs(gp.axes.ly) > 0.15 || Math.abs(gp.axes.rx) > 0.15 || Math.abs(gp.axes.ry) > 0.15 || Math.abs(gp.axes.rt) > 0.15 || gp.axes.rtPressed || gp.edges.length > 0 || gp.buttons.some(b => b.pressed));\n      if (active) {'
);
// Fix closing brace
f = f.replace(
  '      console.log("[Gamepad] axes:", {lx: gp.axes.lx.toFixed(2), ly: gp.axes.ly.toFixed(2), rx: gp.axes.rx.toFixed(2), ry: gp.axes.ry.toFixed(2), rt: gp.axes.rt.toFixed(2), rtPressed: gp.axes.rtPressed}, "edges:", gp.edges, "buttons:", gp.buttons.map((b,i)=>b.pressed?i:null).filter(x=>x!==null));\n    }',
  '        console.log("[Gamepad] axes:", {lx: gp.axes.lx.toFixed(2), ly: gp.axes.ly.toFixed(2), rx: gp.axes.rx.toFixed(2), ry: gp.axes.ry.toFixed(2), rt: gp.axes.rt.toFixed(2), rtPressed: gp.axes.rtPressed}, "edges:", gp.edges, "buttons:", gp.buttons.map((b,i)=>b.pressed?i:null).filter(x=>x!==null));\n      }\n    }'
);
fs.writeFileSync('src/components/Player/PlayerController.jsx', f);
console.log('replaced');

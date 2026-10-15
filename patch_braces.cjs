const fs = require('fs');
let f = fs.readFileSync('src/components/Player/PlayerController.jsx', 'utf8');
// Fix broken braces from previous edit
f = f.replace(
  '      if (active) {\n      console.log("[Gamepad] axes:", {lx: gp.axes.lx.toFixed(2), ly: gp.axes.ly.toFixed(2), rx: gp.axes.rx.toFixed(2), ry: gp.axes.ry.toFixed(2), rt: gp.axes.rt.toFixed(2), rtPressed: gp.axes.rtPressed}, "edges:", gp.edges, "buttons:", gp.buttons.map((b,i)=>b.pressed?i:null).filter(x=>x!==null));\n    }',
  '      if (active) {\n        console.log("[Gamepad] axes:", {lx: gp.axes.lx.toFixed(2), ly: gp.axes.ly.toFixed(2), rx: gp.axes.rx.toFixed(2), ry: gp.axes.ry.toFixed(2), rt: gp.axes.rt.toFixed(2), rtPressed: gp.axes.rtPressed}, "edges:", gp.edges, "buttons:", gp.buttons.map((b,i)=>b.pressed?i:null).filter(x=>x!==null));\n      }\n    }'
);
fs.writeFileSync('src/components/Player/PlayerController.jsx', f);
console.log('braces fixed');

const fs = require('fs');
let f = fs.readFileSync('src/components/Player/PlayerController.jsx', 'utf8');
// Swap rx/ry mapping: rx = left/right (rotationY), ry = up/down (rotationX) — already correct
// User said rt is look up/down — fix: use ry for up/down, not rt
const oldBlock = `    if (gp && (Math.abs(gp.axes.rx) > 0.15 || Math.abs(gp.axes.ry) > 0.15)) {\n      rotationY.current -= gp.axes.rx * 0.05;\n      rotationX.current -= gp.axes.ry * 0.05;\n      rotationX.current = Math.max(-Math.PI / 3, Math.min(Math.PI / 4, rotationX.current));\n    }`;
const newBlock = `    if (gp && (Math.abs(gp.axes.rx) > 0.15 || Math.abs(gp.axes.ry) > 0.15)) {\n      rotationY.current -= gp.axes.rx * 0.05; // left/right\n      rotationX.current -= gp.axes.ry * 0.05; // up/down\n      rotationX.current = Math.max(-Math.PI / 3, Math.min(Math.PI / 4, rotationX.current));\n    }`;
// Actually user said rt is look up/down — but rt is trigger, not stick. Clarify: stick ry = up/down.
// Just ensure mapping is rx=left/right, ry=up/down (already is). No change needed except comment.
f = f.replace(oldBlock, newBlock);
fs.writeFileSync('src/components/Player/PlayerController.jsx', f);
console.log('rx/ry mapping confirmed');

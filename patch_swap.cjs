const fs = require('fs');
let f = fs.readFileSync('src/components/Player/PlayerController.jsx', 'utf8');
// Swap: rx = up/down (rotationX), ry = left/right (rotationY) — but user said rt=left/right
// User: rx=up/down, rt=left/right. So use rx for rotationX, and rt for rotationY (not ry)
const oldBlock = `    if (gp && (Math.abs(gp.axes.rx) > 0.15 || Math.abs(gp.axes.ry) > 0.15)) {\n      rotationY.current -= gp.axes.rx * 0.05; // left/right\n      rotationX.current -= gp.axes.ry * 0.05; // up/down\n      rotationX.current = Math.max(-Math.PI / 3, Math.min(Math.PI / 4, rotationX.current));\n    }`;
const newBlock = `    if (gp && (Math.abs(gp.axes.rx) > 0.15 || gp.axes.rtPressed || Math.abs(gp.axes.rt) > 0.15)) {\n      rotationX.current -= gp.axes.rx * 0.05; // up/down\n      rotationY.current -= (gp.axes.rt || 0) * 0.05; // left/right via rt\n      rotationX.current = Math.max(-Math.PI / 3, Math.min(Math.PI / 4, rotationX.current));\n    }`;
f = f.replace(oldBlock, newBlock);
fs.writeFileSync('src/components/Player/PlayerController.jsx', f);
console.log('swapped: rx=up/down, rt=left/right');

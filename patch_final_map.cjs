const fs = require('fs');
let f = fs.readFileSync('src/components/Player/PlayerController.jsx', 'utf8');
// Fix moveX: add lx back
f = f.replace('moveX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0) + (mobileInput.x || 0);', 'moveX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0) + (mobileInput.x || 0) + (gp ? gp.axes.lx : 0);');
// Fix moveZ: ly only (no rt)
f = f.replace('moveZ = (keys.backward ? 1 : 0) - (keys.forward ? 1 : 0) - (mobileInput.y || 0) + (gp ? gp.axes.ly : 0);', 'moveZ = (keys.backward ? 1 : 0) - (keys.forward ? 1 : 0) - (mobileInput.y || 0) + (gp ? gp.axes.ly : 0);');
// Fix look: rx = up/down, rt = left/right (already set, just confirm)
const oldLook = `    if (gp && (Math.abs(gp.axes.rx) > 0.15 || gp.axes.rtPressed || Math.abs(gp.axes.rt) > 0.15)) {\n      rotationX.current -= gp.axes.rx * 0.05; // up/down\n      rotationY.current -= (gp.axes.rt || 0) * 0.05; // left/right via rt\n      rotationX.current = Math.max(-Math.PI / 3, Math.min(Math.PI / 4, rotationX.current));\n    }`;
const newLook = `    if (gp && (Math.abs(gp.axes.rx) > 0.15 || gp.axes.rtPressed || Math.abs(gp.axes.rt) > 0.15)) {\n      rotationX.current -= gp.axes.rx * 0.05; // rx = up/down\n      rotationY.current -= (gp.axes.rt || 0) * 0.05; // rt = left/right\n      rotationX.current = Math.max(-Math.PI / 3, Math.min(Math.PI / 4, rotationX.current));\n    }`;
f = f.replace(oldLook, newLook);
fs.writeFileSync('src/components/Player/PlayerController.jsx', f);
console.log('lx=left/right, ly=forward/back, rx=up/down, rt=left/right');

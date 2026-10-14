const fs = require('fs');
let f = fs.readFileSync('src/components/Player/PlayerController.jsx', 'utf8');
// Add rx/ry to rotation update inside onMouseMove (keep mouse)
const oldMouse = `        rotationY.current -= e.movementX * 0.002;\n        rotationX.current -= e.movementY * 0.002;`;
const newMouse = `        rotationY.current -= e.movementX * 0.002;\n        rotationX.current -= e.movementY * 0.002;\n        // Gamepad right stick look (retains mouse)\n        if (gp && gp.axes.rx !== undefined) {\n          rotationY.current -= gp.axes.rx * 0.05;\n          rotationX.current -= gp.axes.ry * 0.05;\n        }`;
// But gp isn't in scope there. Instead add in useFrame after gp poll.
const oldPoll = `    const gp = poll ? poll(0.016) : null;`;
const newPoll = `    const gp = poll ? poll(0.016) : null;\n    // Gamepad right stick look (retains mouse)\n    if (gp && (Math.abs(gp.axes.rx) > 0.15 || Math.abs(gp.axes.ry) > 0.15)) {\n      rotationY.current -= gp.axes.rx * 0.05;\n      rotationX.current -= gp.axes.ry * 0.05;\n      rotationX.current = Math.max(-Math.PI / 3, Math.min(Math.PI / 4, rotationX.current));\n    }`;
f = f.replace(oldPoll, newPoll);
fs.writeFileSync('src/components/Player/PlayerController.jsx', f);
console.log('rx/ry look added');

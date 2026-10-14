const fs = require('fs');
let f = fs.readFileSync('src/components/Player/PlayerController.jsx', 'utf8');
f = f.replace('const dashInput = !!(keys.dash || mobileInput.dash);', 'const dashInput = !!(keys.dash || mobileInput.dash || (gp && gp.buttons[1] && gp.buttons[1].pressed));');
fs.writeFileSync('src/components/Player/PlayerController.jsx', f);
console.log('btn1=dash');

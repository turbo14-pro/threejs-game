const fs = require('fs');
let f = fs.readFileSync('src/components/Player/PlayerController.jsx', 'utf8');
// Button 2 = jump
f = f.replace('jumpingInput = !!(keys.jump || mobileInput.jump);', 'jumpingInput = !!(keys.jump || mobileInput.jump || (gp && gp.buttons[2] && gp.buttons[2].pressed));');
fs.writeFileSync('src/components/Player/PlayerController.jsx', f);
console.log('btn2=jump');

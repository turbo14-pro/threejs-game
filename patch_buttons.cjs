const fs = require('fs');
let f = fs.readFileSync('src/components/Player/PlayerController.jsx', 'utf8');
// Button 7 = slide tackle (slidingInput)
// Button 6 = walk (hold) — change walkingInput to include button 6 pressed
f = f.replace('walkingInput = !!(keys.walk || mobileInput.walk);', 'walkingInput = !!(keys.walk || mobileInput.walk || (gp && gp.buttons[6] && gp.buttons[6].pressed));');
// Sliding: button 7 pressed
f = f.replace('slidingInput = !!(keys.slide || mobileInput.slide);', 'slidingInput = !!(keys.slide || mobileInput.slide || (gp && gp.buttons[7] && gp.buttons[7].pressed));');
fs.writeFileSync('src/components/Player/PlayerController.jsx', f);
console.log('btn7=slide, btn6=walk');

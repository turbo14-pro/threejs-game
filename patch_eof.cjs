const fs = require('fs');
let f = fs.readFileSync('src/components/Player/PlayerController.jsx', 'utf8');
// Find the end of file and check if useFrame is closed
const lastBrace = f.lastIndexOf('}');
// We need to close useFrame. The file ends at line 368 with just } which closes the if(gp) block.
// We need to add closing braces for the rest of useFrame and component.
// Let's find where useFrame starts and count braces from there.
const useFrameIdx = f.indexOf('useFrame((state, delta) => {');
let count = 0;
for (let i = useFrameIdx; i < f.length; i++) {
  if (f[i] === '{') count++;
  else if (f[i] === '}') count--;
}
// count should be 1 (useFrame open) + any others; if negative or wrong, fix
console.log('brace balance from useFrame:', count);
// Just append missing closing braces to end
if (count > 0) {
  f += '\n'.repeat(count) + '}'.repeat(count);
}
fs.writeFileSync('src/components/Player/PlayerController.jsx', f);
console.log('appended', count, 'braces');

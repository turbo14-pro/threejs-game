const fs = require('fs');
let f = fs.readFileSync('src/components/Player/PlayerController.jsx', 'utf8');
// Direct line-based replacement
const lines = f.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('if (active) {')) {
    // Find console.log line after it
    for (let j = i+1; j < lines.length; j++) {
      if (lines[j].trim().startsWith('console.log')) {
        lines[j] = '        ' + lines[j].trim();
      }
      if (lines[j].trim() === '}' && j > i+1) {
        // Check if this closes active or gp
        // We want two closing braces after console.log
        // Just insert missing ones
        lines.splice(j+1, 0, '      }', '    }');
        break;
      }
    }
    break;
  }
}
fs.writeFileSync('src/components/Player/PlayerController.jsx', lines.join('\n'));
console.log('line fixed');

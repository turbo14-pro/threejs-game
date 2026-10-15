const fs = require('fs');
let f = fs.readFileSync('src/components/Player/PlayerController.jsx', 'utf8');
const lines = f.split('\n');
// Find the line with console.log and the extra braces after it
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim().startsWith('console.log("[Gamepad]')) {
    // The console.log line should be indented 8 spaces; fix if needed
    lines[i] = '        ' + lines[i].trim();
    // After this line, there should be two closing braces: one for if(active), one for if(gp)
    // Check next lines
    let j = i + 1;
    // Remove any extra/misplaced braces and insert correct ones
    // We expect: } (close active), } (close gp)
    // Let's just rebuild from i+1
    const after = lines.slice(i+1);
    // Find first non-empty line after console.log
    let k = 0;
    while (k < after.length && after[k].trim() === '') k++;
    // Replace from i+1 with correct braces
    lines.splice(i+1, after.length - k, '      }', '    }');
    break;
  }
}
fs.writeFileSync('src/components/Player/PlayerController.jsx', lines.join('\n'));
console.log('rebuilt');

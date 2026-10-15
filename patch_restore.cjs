const fs = require('fs');
let f = fs.readFileSync('src/components/Player/PlayerController.jsx', 'utf8');
// Find the bad closing at end and replace with correct one that closes useFrame properly
// The file currently ends with the console.log block then  });\n});
// We need to insert the rest of useFrame content (translation, etc.) before closing.
// Actually easiest: restore from git or backup if exists. Check for backup.
console.log('checking backups...');

const { execSync } = require('child_process');
const path = require('path');

function run(cmd) {
  console.log(`\n▶ Running: ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

try {
  run('npx --prefix backend prisma db push --accept-data-loss');
} catch (err) {
  console.warn('⚠️ Prisma db push warning (proceeding):', err.message);
}

// Start backend server
require('../backend/server.js');

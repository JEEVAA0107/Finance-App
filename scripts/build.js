const { execSync } = require('child_process');

function run(cmd) {
  console.log(`\n▶ Running: ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

try {
  run('npm --prefix backend install --omit=optional');
  run('npm --prefix frontend install');
  run('npm --prefix frontend run build');
  run('npm --prefix backend run build');
  console.log('\n✅ All builds completed successfully!');
} catch (err) {
  console.error('\n❌ Build step failed:', err.message);
  process.exit(1);
}

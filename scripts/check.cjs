// Check all owned JavaScript without touching the vendored Three.js bundle.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const files = fs.readdirSync(root).filter(name => name.endsWith('.js'));
files.push(...fs.readdirSync(__dirname).filter(name => name.endsWith('.cjs')).map(name => `scripts/${name}`));
for (const file of files.sort()) {
  const result = spawnSync(process.execPath, ['--check', file], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`JavaScript syntax passed (${files.length} files).`);

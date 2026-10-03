// Prefer the repository venv. Activation in a setup shell is not required.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const venvPython = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const python = fs.existsSync(venvPython) ? venvPython : process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const args = process.argv.slice(2);
const jobs = args[0] === '--suite'
  ? ['browser_check.py', 'crystal_check.py', 'atmosphere_check.py'].map(name => [`scripts/${name}`])
  : [args];
if (!args.length) {
  console.error('Usage: node scripts/python.cjs <Python arguments> | --suite');
  process.exit(2);
}
for (const job of jobs) {
  const result = spawnSync(python, job, {
    cwd: root, stdio: 'inherit', env: { ...process.env, PYTHONUTF8: '1', PYTHONUNBUFFERED: '1' }
  });
  if (result.error) {
    console.error(`Cannot run ${python}: ${result.error.message}. See docs/CODEX-CLOUD.md for setup.`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status || 1);
}

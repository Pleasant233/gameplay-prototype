#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

node -e 'if (Number(process.versions.node.split(".")[0]) < 22) throw new Error("Node.js 22+ required; use Node.js 24")'
npm ci --no-audit --no-fund

python_command="${PYTHON:-python3}"
"$python_command" -c 'import sys; assert sys.version_info >= (3, 10), "Python 3.10+ required"'
if [[ ! -d .venv ]]; then
  "$python_command" -m venv .venv
fi
venv_python=".venv/bin/python"
if [[ ! -x "$venv_python" ]]; then
  venv_python=".venv/Scripts/python.exe"
fi
"$venv_python" -m pip install --disable-pip-version-check -r requirements.txt

# Persist in the prepared filesystem; no shell export/activation is needed.
# --reuse skips apt on a legacy cached container; browser downloads are cached.
if [[ "$(uname -s)" == Linux && "${1:-}" != --reuse ]]; then
  "$venv_python" -m playwright install --with-deps chromium
  # Keep Chinese UI text readable in headless Linux screenshots.
  if [[ "$(id -u)" == 0 ]]; then
    apt-get install -y --no-install-recommends fonts-noto-cjk
  else
    sudo apt-get install -y --no-install-recommends fonts-noto-cjk
  fi
else
  "$venv_python" -m playwright install chromium
fi
npm test
npm run test:smoke

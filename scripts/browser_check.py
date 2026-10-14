"""Published Python entry point for the current desktop/mobile WebGL suite."""
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parent.parent
raise SystemExit(subprocess.call(['node', str(root / 'scripts' / 'requirements_check.cjs')], cwd=root))

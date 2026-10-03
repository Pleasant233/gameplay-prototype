#!/usr/bin/env bash
set -euo pipefail
# Legacy cached environments can update pinned tools after changing branches.
bash "$(dirname "${BASH_SOURCE[0]}")/setup.sh" --reuse

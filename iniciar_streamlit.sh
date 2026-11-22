#!/usr/bin/env bash
set -euo pipefail

: "${PORT:?Debe definir PORT para el servicio web}"
APP_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

exec python -m streamlit run "$APP_DIR/app.py" \
  --server.address=0.0.0.0 \
  --server.port="$PORT" \
  --server.headless=true \
  --server.fileWatcherType=none \
  --browser.gatherUsageStats=false

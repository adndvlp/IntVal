#!/usr/bin/env bash
set -euo pipefail

: "${PORT:?Debe definir PORT para el servicio web}"
if [[ ! "$PORT" =~ ^[0-9]{1,5}$ ]] || (( 10#$PORT < 1 || 10#$PORT > 65535 )); then
  printf '%s\n' 'PORT debe ser un entero entre 1 y 65535.' >&2
  exit 64
fi
APP_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

exec python -m uvicorn valoracion.web.distribucion:create_app \
  --factory \
  --host 0.0.0.0 \
  --port "$PORT" \
  --workers 1

#!/usr/bin/env bash
set -euo pipefail
APP=/mnt/data/apps/Vectracom
cd "$APP"
KEY="${1:?MapTiler key required}"

if grep -q '^NEXT_PUBLIC_MAPTILER_KEY=' .env 2>/dev/null; then
  sed -i "s|^NEXT_PUBLIC_MAPTILER_KEY=.*|NEXT_PUBLIC_MAPTILER_KEY=${KEY}|" .env
else
  echo "NEXT_PUBLIC_MAPTILER_KEY=${KEY}" >> .env
fi

API="$(grep '^NEXT_PUBLIC_API_URL=' .env 2>/dev/null | head -1 | cut -d= -f2- || true)"
if [ -z "$API" ]; then
  API="https://vectracom.track-it.org/api/v1"
fi
printf 'NEXT_PUBLIC_API_URL=%s\nNEXT_PUBLIC_MAPTILER_KEY=%s\n' "$API" "$KEY" > web-admin/.env

python3 - <<'PY'
from pathlib import Path
import re
p = Path('docker-compose.yml')
t = p.read_text()
if 'NEXT_PUBLIC_MAPTILER_KEY' in t:
    print('compose already has MAPTILER')
elif 'NEXT_PUBLIC_API_URL: https://vectracom.track-it.org/api/v1' in t:
    p.write_text(t.replace(
        '        NEXT_PUBLIC_API_URL: https://vectracom.track-it.org/api/v1',
        '        NEXT_PUBLIC_API_URL: https://vectracom.track-it.org/api/v1\n        NEXT_PUBLIC_MAPTILER_KEY: ${NEXT_PUBLIC_MAPTILER_KEY}',
    ))
    print('compose patched (hardcoded api)')
else:
    t2, n = re.subn(
        r'(NEXT_PUBLIC_API_URL:[^\n]+)',
        r'\1\n        NEXT_PUBLIC_MAPTILER_KEY: ${NEXT_PUBLIC_MAPTILER_KEY}',
        t,
        count=1,
    )
    if not n:
        raise SystemExit('could not patch compose')
    p.write_text(t2)
    print('compose patched (regex)')
PY

echo '=== compose snippet ==='
grep -A8 'web-admin:' docker-compose.yml | head -15
grep MAPTILER .env | sed -E 's/(=).*/\1***/'
grep MAPTILER web-admin/.env | sed -E 's/(=).*/\1***/'

echo '=== rebuild web-admin ==='
docker compose build --no-cache web-admin
docker compose up -d web-admin
sleep 5
curl -sS -m 10 -o /dev/null -w 'web:%{http_code}\n' http://127.0.0.1:3101/
if docker exec vectracom-web sh -c "grep -R -l 'api.maptiler.com' /app/.next 2>/dev/null | head -3"; then
  echo MAPTILER_BAKED=yes
else
  echo MAPTILER_BAKED=no
fi

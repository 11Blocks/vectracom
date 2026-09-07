#!/usr/bin/env bash
# VECTRACOM — Arrêt complet
echo "=== VECTRACOM — Arrêt ==="

# API
PID=$(netstat -ano 2>/dev/null | grep ":3100" | grep LISTENING | head -1 | awk '{print $NF}')
if [ -n "$PID" ]; then
  taskkill //F //PID $PID 2>/dev/null || kill $PID 2>/dev/null || true
  echo "Backend arrêté (PID $PID)"
fi

# Infrastructure
cd "$(dirname "$0")"
docker compose down
echo "PostgreSQL + Redis arrêtés"
echo "=== VECTRACOM arrêté ==="

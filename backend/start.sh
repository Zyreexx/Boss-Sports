#!/usr/bin/env bash
set -o errexit

echo "=== [Boss Arena] Booting Services ==="

if [ "${RUN_EMBEDDED_CELERY:-false}" = "true" ]; then
  echo "WARNING: Running Celery worker & Beat embedded in the web process (single-container fallback)."
  echo "For multi-instance production scaling, use dedicated worker & beat services and set RUN_EMBEDDED_CELERY=false."
  celery -A boss_backend worker -l info --concurrency=2 &
  celery -A boss_backend beat -l info &
fi

echo "-> Starting Gunicorn HTTP server on port ${PORT:-8000}..."
exec gunicorn boss_backend.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers ${WEB_CONCURRENCY:-2} --timeout 120

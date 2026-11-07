#!/usr/bin/env bash
set -o errexit

echo "=== [Boss Arena] Booting Services ==="

# 1. Start Celery Worker in the background
echo "-> Starting Celery async task worker..."
celery -A boss_backend worker -l info --concurrency=2 &

# 2. Start Celery Beat in the background (periodic slot release)
echo "-> Starting Celery beat scheduler..."
celery -A boss_backend beat -l info &

# 3. Start Gunicorn Web Server in foreground (binds to Render's dynamic $PORT)
echo "-> Starting Gunicorn HTTP server on port $PORT..."
exec gunicorn boss_backend.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2 --timeout 120

#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt
chmod +x ./start.sh

python manage.py collectstatic --no-input
python manage.py migrate --no-input

# Only seed empty structural tables (courts, default schedule, pricing config); never overwrites production accounts
python seed.py --structural-only

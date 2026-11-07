#!/usr/bin/env bash
# Exit on error
set -o errexit

# Install python dependencies
pip install -r requirements.txt

# Collect static files for Django Admin
python manage.py collectstatic --no-input

# Run database migrations
python manage.py migrate

# Seed initial accounts (Owner, Staff, Customer), Courts, and Gallery loops
python seed.py

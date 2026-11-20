#!/bin/sh
# NEXUS Ω: one isolated interpreter, no site initialization before or after check.
set -eu
cd "$(dirname "$0")"
exec python -I -S nexus_prestart.py --source requirements.txt --worker worker.py

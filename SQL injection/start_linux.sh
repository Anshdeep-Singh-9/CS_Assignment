#!/usr/bin/env bash
# CampusShield local educational demo launcher for Ubuntu / WSL / macOS.
# Do not forward port 8000 outside the machine.
set -e
cd "$(dirname "$0")"
echo "CampusShield will run at http://127.0.0.1:8000"
echo "Open that URL in your browser and press Ctrl+C here when finished."
exec python3 server.py

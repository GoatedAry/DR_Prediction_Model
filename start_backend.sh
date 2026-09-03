#!/usr/bin/env bash
# NetraAI FastAPI Backend Server Launcher
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=========================================================="
echo "⚡ Starting NetraAI Medical Diagnosis Backend on :8000..."
echo "=========================================================="

if [ -f "$DIR/venv/bin/uvicorn" ]; then
    UVICORN_CMD="$DIR/venv/bin/uvicorn"
elif [ -f "$DIR/.venv/bin/uvicorn" ]; then
    UVICORN_CMD="$DIR/.venv/bin/uvicorn"
elif command -v uvicorn &>/dev/null; then
    UVICORN_CMD="uvicorn"
else
    echo "ℹ️ Launching via python -m uvicorn..."
    UVICORN_CMD="python3 -m uvicorn"
fi

export PYTHONPATH="$DIR/backend:$DIR/dia-model:$PYTHONPATH"
$UVICORN_CMD backend.main:app --host 127.0.0.1 --port 8000 --reload

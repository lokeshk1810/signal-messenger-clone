#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Cleaning up any existing processes on ports 8000 and 3000..."
fuser -k 8000/tcp 3000/tcp 2>/dev/null || true
pkill -f "uvicorn main:app" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
sleep 1

echo "==> Starting Signal Clone Full Stack..."

# Start Backend
cd "$PROJECT_DIR/backend"
if [ ! -d "venv" ]; then
    echo "Setting up backend venv..."
    python3 -m venv venv
    ./venv/bin/pip install -r requirements.txt
fi
source venv/bin/activate
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
echo "Backend running on PID $BACKEND_PID (http://localhost:8000)"

# Start Frontend
cd "$PROJECT_DIR/frontend"
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi
npm run dev -- -p 3000 &
FRONTEND_PID=$!
echo "Frontend running on PID $FRONTEND_PID (http://localhost:3000)"

cleanup() {
    echo ""
    echo "Stopping servers..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    fuser -k 8000/tcp 3000/tcp 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

wait

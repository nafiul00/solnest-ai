#!/bin/bash
# ============================================================
# Solnest AI — Unified Startup Script
#
# Usage:
#   ./start.sh           # Start all services
#   ./start.sh --stop    # Stop all services
#
# Prerequisites:
#   1. Copy .env.example to .env and fill in your API keys
#   2. python3 must be installed
#   3. node must be installed (v18+)
# ============================================================

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$DIR/.env"
PYTHON_PID_FILE="/tmp/solnest-python-engine.pid"
NODE_PID_FILE="/tmp/solnest-scheduler.pid"
BACKEND_PID_FILE="/tmp/solnest-cortex-backend.pid"
DASHBOARD_PID_FILE="/tmp/solnest-dashboard.pid"

# ── Stop mode ──────────────────────────────────────────────
if [ "$1" = "--stop" ]; then
  echo "[Solnest] Stopping services..."
  for pidfile in "$PYTHON_PID_FILE" "$NODE_PID_FILE" "$BACKEND_PID_FILE" "$DASHBOARD_PID_FILE"; do
    if [ -f "$pidfile" ]; then
      kill "$(cat "$pidfile")" 2>/dev/null || true
      rm -f "$pidfile"
    fi
  done
  echo "[Solnest] All services stopped."
  exit 0
fi

# ── Preflight checks ────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo ""
  echo "ERROR: .env file not found."
  echo "  Run:  cp .env.example .env"
  echo "  Then fill in your API keys in .env"
  echo ""
  exit 1
fi

# Check ANTHROPIC_API_KEY is set
if ! grep -q "^ANTHROPIC_API_KEY=sk-ant" "$ENV_FILE" 2>/dev/null; then
  echo ""
  echo "ERROR: ANTHROPIC_API_KEY is not set in .env"
  echo "  Add your key:  ANTHROPIC_API_KEY=sk-ant-api03-..."
  echo ""
  exit 1
fi

if ! command -v python3 &>/dev/null; then
  echo "ERROR: python3 not found. Install Python 3.9+."
  exit 1
fi

if ! command -v node &>/dev/null; then
  echo "ERROR: node not found. Install Node.js 18+."
  exit 1
fi

# ── Install Python dependencies ─────────────────────────────
echo "[Solnest] Checking Python dependencies..."
cd "$DIR/Revenue Management Agent Project"
if ! python3 -c "import flask" 2>/dev/null; then
  echo "[Solnest] Installing Python dependencies..."
  pip3 install -r requirements.txt --quiet
fi
cd "$DIR"

# ── Install Node.js dependencies ────────────────────────────
echo "[Solnest] Checking Node.js dependencies..."
cd "$DIR/revenue-intel"
if [ ! -d "node_modules" ]; then
  echo "[Solnest] Installing Node.js dependencies (revenue-intel)..."
  npm install --silent
fi
cd "$DIR"

cd "$DIR/cortex-backend"
if [ ! -d "node_modules" ]; then
  echo "[Solnest] Installing Node.js dependencies (cortex-backend)..."
  npm install --silent
fi
cd "$DIR"

cd "$DIR/cortex-dashboard"
if [ ! -d "node_modules" ]; then
  echo "[Solnest] Installing Node.js dependencies (cortex-dashboard)..."
  npm install --silent
fi
cd "$DIR"

# ── Start Python Revenue Engine ─────────────────────────────
echo "[Solnest] Starting Python revenue engine on port 5050..."
cd "$DIR/Revenue Management Agent Project"
python3 serve.py > /tmp/solnest-python-engine.log 2>&1 &
PYTHON_PID=$!
echo $PYTHON_PID > "$PYTHON_PID_FILE"
cd "$DIR"

# Wait for engine to be ready
for i in $(seq 1 10); do
  if curl -s http://localhost:5050/health > /dev/null 2>&1; then
    echo "[Solnest] Python revenue engine is ready. (PID: $PYTHON_PID)"
    break
  fi
  sleep 1
done

# ── Start Revenue Intel Scheduler ───────────────────────────
echo "[Solnest] Starting Revenue Intel scheduler..."
cd "$DIR/revenue-intel"
node index.js > /tmp/solnest-scheduler.log 2>&1 &
NODE_PID=$!
echo $NODE_PID > "$NODE_PID_FILE"
cd "$DIR"

# ── Start CORTEX Backend ─────────────────────────────────────
echo "[Solnest] Starting CORTEX backend on port 3001..."
cd "$DIR/cortex-backend"
node index.js > /tmp/solnest-cortex-backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > "$BACKEND_PID_FILE"
cd "$DIR"
sleep 2

# ── Start CORTEX Dashboard (dev mode) ───────────────────────
echo "[Solnest] Starting CORTEX dashboard on port 5173..."
cd "$DIR/cortex-dashboard"
npm run dev > /tmp/solnest-dashboard.log 2>&1 &
DASHBOARD_PID=$!
echo $DASHBOARD_PID > "$DASHBOARD_PID_FILE"
cd "$DIR"

echo ""
echo "============================================================"
echo " Solnest AI is running"
echo "============================================================"
echo " CORTEX Dashboard      : http://localhost:5173"
echo " CORTEX Backend API    : http://localhost:3001/api/health"
echo " Python Revenue Engine : http://localhost:5050/health"
echo ""
echo " Logs:"
echo "   cortex-backend      : /tmp/solnest-cortex-backend.log"
echo "   dashboard           : /tmp/solnest-dashboard.log"
echo "   scheduler           : /tmp/solnest-scheduler.log"
echo "   python engine       : /tmp/solnest-python-engine.log"
echo ""
echo " Stop all services:  ./start.sh --stop"
echo "============================================================"

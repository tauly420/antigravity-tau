#!/bin/bash
# Quick start script for Tau-LY Lab Tools
# Run this from the project root directory

echo "🚀 Starting Tau-LY Lab Tools..."

# Check if backend is already set up
if [ ! -d ".venv" ]; then
    echo "📦 Setting up Python virtual environment..."
    python3 -m venv .venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source .venv/bin/activate

# Install Python dependencies
if ! pip show flask > /dev/null 2>&1; then
    echo "📥 Installing Python dependencies..."
    pip install -r requirements.txt
fi

# Check if frontend dependencies are installed
if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend
    npm install --legacy-peer-deps
    cd ..
fi

# Start backend in background
echo "🖥️  Starting Flask backend on http://localhost:5000..."
cd backend
python app.py &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 2

# Start frontend
echo "🎨 Starting React frontend on http://localhost:5173..."
cd frontend
npm run dev &
FRONTEND_PID=$!

# Trap Ctrl+C and cleanup
trap "echo ''; echo '👋 Shutting down...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT

echo ""
echo "✅ Tau-LY Lab Tools is running!"
echo "   Backend:  http://localhost:5000"
echo "   Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop"

# Wait for processes
wait

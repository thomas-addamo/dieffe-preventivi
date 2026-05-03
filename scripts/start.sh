#!/bin/bash
set -e
cd "$(dirname "$0")/.."

echo "🏗  Dieffe Preventivi — avvio..."

# install dependencies if needed
if [ ! -d "node_modules/.pnpm" ]; then
  echo "📦 Installazione dipendenze..."
  pnpm install
fi

# run migrations and seed if DB doesn't exist
if [ ! -f "storage/database.sqlite" ]; then
  echo "🗃  Inizializzazione database..."
  pnpm db:migrate
  pnpm db:seed
fi

# build if .next doesn't exist
if [ ! -d ".next/standalone" ]; then
  echo "🔨 Build in corso (solo al primo avvio)..."
  pnpm build
fi

echo "🚀 Server in avvio su http://localhost:3847"
node .next/standalone/server.js &
SERVER_PID=$!

sleep 2
open http://localhost:3847 2>/dev/null || xdg-open http://localhost:3847 2>/dev/null || echo "Apri il browser su: http://localhost:3847"

echo "   Premi Ctrl+C per fermare il server"
wait $SERVER_PID

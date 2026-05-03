@echo off
cd /d "%~dp0.."

echo Dieffe Preventivi - avvio...

if not exist "node_modules\.pnpm" (
  echo Installazione dipendenze...
  call pnpm install
)

if not exist "storage\database.sqlite" (
  echo Inizializzazione database...
  call pnpm db:migrate
  call pnpm db:seed
)

if not exist ".next\standalone" (
  echo Build in corso (solo al primo avvio)...
  call pnpm build
)

echo Server in avvio su http://localhost:3847
start "" "http://localhost:3847"
node .next\standalone\server.js

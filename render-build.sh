#!/bin/bash
# Render build script: builds frontend + backend and places the SPA where
# backend/src/server.ts serves it (backend/static/frontend/browser).
set -e

# ── Frontend ────────────────────────────────────────────────────────────────
cd frontend
npm ci || npm install
npm run build
cd ..

# ── Backend ─────────────────────────────────────────────────────────────────
cd backend
npm ci || npm install
npm run build
cd ..

# ── Place SPA build for same-origin serving ─────────────────────────────────
rm -rf backend/static
mkdir -p backend/static
cp -R frontend/dist/frontend backend/static/frontend

echo "✅ Build complete. Start with: node backend/dist/server.js"

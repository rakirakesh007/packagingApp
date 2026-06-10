# Build and Deploy

## Development

### Frontend
```bash
cd frontend
npm install
ng serve
# Runs on http://localhost:4200
# API calls proxied to http://localhost:3000 via proxy.conf.json
```

### Backend
```bash
cd backend
npm install
npm run dev
# Runs on http://localhost:3000
```

## Production Build

### Frontend
```bash
cd frontend
ng build --configuration production
# Output: frontend/dist/
```

### Backend
```bash
cd backend
npm run build
# Compiles TypeScript to JavaScript
```

## Deployment (Render + MongoDB Atlas)

See [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) for full details.

**One Render Web Service serves both the API and the Angular PWA** — `render-build.sh`
builds both and `server.ts` serves the SPA from `backend/static/frontend/browser`
with an index.html fallback. Same origin → relative API URLs work, no CORS.

### Quick Steps
1. Push code to GitHub
2. Create MongoDB Atlas cluster (replica set — required for transactions)
3. Render Web Service at the **repo root**: build `./render-build.sh`, start `node backend/dist/server.js`, health check `/health`
4. Set env vars (below); create the admin via `ADMIN_PASSWORD=... npx ts-node src/seed-users.ts`
5. Delivery boy installs the PWA: open the URL in Chrome → Add to Home Screen

### Environment Variables (Backend)
| Variable | Description |
|----------|-------------|
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Secret for JWT signing — **required in production** (server exits without it) |
| `NODE_ENV` | `production` on Render |
| `FRONTEND_ORIGIN` | Optional extra CORS origin (same-origin serving usually makes this unnecessary) |
| `PORT` | Server port (default: 3000; Render sets this automatically) |

# Local Development Setup

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | `nvm install 20 && nvm use 20` |
| Angular CLI | 21.x | `npm i -g @angular/cli` |
| MongoDB | 7.x+ | Local install or MongoDB Atlas |
| Git | Latest | `brew install git` (macOS) |

## Setup Steps

### 1. Clone the Repository
```bash
git clone <repo-url> my_sales_app
cd my_sales_app
```

### 2. Backend Setup
```bash
cd backend
npm install
```

Create `.env` file:
```env
MONGO_URI=mongodb://localhost:27017/my_sales_app
JWT_SECRET=your-secret-key
PORT=3000
```

Start backend:
```bash
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend
npm install
ng serve
```

Frontend runs on `http://localhost:4200` with API proxy to `http://localhost:3000`.

### 4. Seed Data (Optional)
```bash
cd backend
npx ts-node src/seed.ts
npx ts-node src/seed-users.ts
```

## Proxy Configuration

The frontend proxies API calls via `frontend/proxy.conf.json`. Each backend resource is proxied by its **root path** (there is no `/api` prefix). When you add a new backend route, add its top-level path here too:
```json
{
  "/auth":       { "target": "http://localhost:3000", "secure": false, "changeOrigin": true },
  "/inventory":  { "target": "http://localhost:3000", "secure": false, "changeOrigin": true },
  "/sale":       { "target": "http://localhost:3000", "secure": false, "changeOrigin": true },
  "/assignment": { "target": "http://localhost:3000", "secure": false, "changeOrigin": true },
  "/admin":      { "target": "http://localhost:3000", "secure": false, "changeOrigin": true },
  "/expenses":   { "target": "http://localhost:3000", "secure": false, "changeOrigin": true },
  "/reports":    { "target": "http://localhost:3000", "secure": false, "changeOrigin": true },
  "/users":      { "target": "http://localhost:3000", "secure": false, "changeOrigin": true },
  "/shops":      { "target": "http://localhost:3000", "secure": false, "changeOrigin": true }
}
```

## Common Issues

| Issue | Solution |
|-------|----------|
| MongoDB connection refused | Ensure MongoDB is running locally or Atlas URI is correct |
| Port 4200 in use | Kill existing process: `lsof -ti:4200 \| xargs kill` |
| CORS errors | Use proxy in dev; backend should set CORS headers for prod |

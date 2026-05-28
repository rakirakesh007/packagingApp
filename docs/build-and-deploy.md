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

### Quick Steps
1. Push code to GitHub
2. Create MongoDB Atlas cluster, get connection string
3. Create Render Web Service pointing to backend folder
4. Set environment variables: `MONGO_URI`, `JWT_SECRET`, `PORT`
5. Deploy frontend as Render Static Site (or serve from backend)

### Environment Variables (Backend)
| Variable | Description |
|----------|-------------|
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Secret for JWT token signing |
| `PORT` | Server port (default: 3000) |

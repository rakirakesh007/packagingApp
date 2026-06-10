# Deployment Guide — DesiMasalaHub on Render + MongoDB Atlas

One Render **Web Service** runs everything: the Express API **and** the Angular PWA
(served from the same origin by `backend/src/server.ts`). The delivery boy installs
the app from Chrome via **Add to Home Screen** — no APK needed, and every deploy
updates his app automatically.

---

## 1. MongoDB Atlas

1. Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register).
2. **Database Access** → add a database user (username & password).
3. **Network Access** → add `0.0.0.0/0` (Render IPs change; restricting is impractical on free tier).
4. **Connect → Connect your application** → copy the connection string:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/<dbname>?retryWrites=true&w=majority
   ```

> Atlas is a replica set, which the app **requires** — sales use MongoDB transactions.

## 2. Render Web Service (single service: API + frontend)

1. Push the repo to GitHub.
2. [Render dashboard](https://dashboard.render.com/) → **New +** → **Web Service** → connect the repo.
3. Settings:
   - **Root Directory:** *(leave empty — repo root)*
   - **Build Command:** `./render-build.sh`
   - **Start Command:** `node backend/dist/server.js`
   - **Health Check Path:** `/health`
4. **Environment Variables:**

   | Variable | Value |
   |----------|-------|
   | `MONGO_URI` | your Atlas connection string |
   | `JWT_SECRET` | strong random secret — generate with `openssl rand -hex 32` |
   | `NODE_ENV` | `production` |
   | `OWNER_WHATSAPP` | `918050991832` |

   The server **refuses to boot in production without `JWT_SECRET`** (no insecure fallback).
5. **Create Web Service** and wait for the first deploy. Your app is live at
   `https://<service-name>.onrender.com`.

## 3. Create the production admin user

Run once from your laptop, pointed at the production database:

```bash
cd backend
MONGO_URI='<your Atlas string>' ADMIN_PASSWORD='<strong password>' npx ts-node src/seed-users.ts
```

Then log in as admin and create delivery boys from **Admin → Delivery Boys**.
**Never** run `src/seed.ts` against production — it wipes inventory with demo data
(and refuses to run when `NODE_ENV=production`).

## 4. Delivery boy phone setup (PWA)

1. On his Android phone, open `https://<service-name>.onrender.com` in **Chrome**.
2. Log in with his delivery-boy account.
3. Chrome menu (⋮) → **Add to Home Screen** (or the "Install app" prompt).
4. The DesiMasalaHub icon appears on his home screen and opens full-screen like an app.

Updates are automatic: every deploy is picked up the next time he opens the app.

## 5. Free-tier behaviour

- Render free tier **sleeps after ~15 min idle**; the first request takes ~30–50 s to
  wake. The app shows its loading bar during this (GlobalLoadingService).
- If that's painful for daily field use, upgrade the service (~$7/mo) for always-on.

## 6. Common issues

| Issue | Fix |
|-------|-----|
| 401 immediately after deploy | `JWT_SECRET` changed → everyone must log in again (expected) |
| MongoDB connection errors | Re-check Atlas URI, db user password, Network Access `0.0.0.0/0` |
| Frontend loads but API fails | Confirm Start Command is `node backend/dist/server.js` and build ran `render-build.sh` |
| Stale app on phone | Close and reopen the PWA twice — the service worker activates the new version on relaunch |

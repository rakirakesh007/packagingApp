# Deployment Guide: Connect to MongoDB Atlas & Deploy to Render

This guide will help you connect your Node.js/Express backend to MongoDB Atlas and deploy your project to Render. Use this as a reference for any similar project.

---

## 1. Connect to MongoDB Atlas

### a. Create a MongoDB Atlas Cluster
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) and sign up or log in.
2. Create a new **free cluster** (select AWS/GCP/Azure, region, etc.).
3. In the cluster dashboard, click **Database Access** and add a database user (username & password).
4. In **Network Access**, add your IP address (or `0.0.0.0/0` for open access, not recommended for production).

### b. Get Your Connection String
1. In the cluster dashboard, click **Connect** > **Connect your application**.
2. Copy the connection string. It looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/<dbname>?retryWrites=true&w=majority
   ```

### c. Update Your .env File
1. In your backend folder, open `.env`.
2. Replace the `MONGO_URI` line with your Atlas string:
   ```
   MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/<dbname>?retryWrites=true&w=majority
   ```
3. Save the file.

---

## 2. Deploy Backend to Render

### a. Push Your Code to GitHub
1. Make sure your project is in a GitHub repository.

### b. Create a New Web Service on Render
1. Go to [Render](https://dashboard.render.com/) and log in.
2. Click **New +** > **Web Service**.
3. Connect your GitHub repo and select your backend folder.
4. Set the **Build Command** to:
   ```
   npm install && npm run build
   ```
5. Set the **Start Command** to:
   ```
   npm run start
   ```
6. In **Environment Variables**, add:
   - `MONGO_URI` (your Atlas string)
   - `JWT_SECRET` (any random string)
   - Any other variables from your `.env`
7. Click **Create Web Service**.

### c. Wait for Build & Deploy
- Render will build and deploy your backend. The logs will show when it's live.
- The public URL will be shown in the dashboard.

---

## 3. Deploy Frontend (Angular/Ionic) to Render (Optional)

1. Build your frontend:
   ```
   cd frontend
   npm run build
   ```
2. Deploy the `dist/` folder to a static site host (Render, Vercel, Netlify, etc.).

---

## 4. Common Issues
- **CORS errors:** Make sure your backend allows requests from your frontend domain.
- **MongoDB connection errors:** Double-check your Atlas URI, user, and network access.
- **Environment variables:** Always set them in Render's dashboard, not just in `.env`.

---

## 5. References
- [MongoDB Atlas Docs](https://www.mongodb.com/docs/atlas/)
- [Render Docs](https://render.com/docs)

---

**Keep this file for all future projects!**
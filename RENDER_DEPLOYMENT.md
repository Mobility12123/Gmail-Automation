# Gmail Automation - Render Deployment Guide

## 📋 Prerequisites

1. **GitHub Account** - Push your code to GitHub
2. **Render Account** - Sign up at https://render.com (free)
3. **Your existing .env values** - You'll copy these to Render

---

## 🚀 Step 1: Push Code to GitHub

```bash
# In your project folder
cd D:\Gmail-Automation

# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Ready for deployment"

# Add your GitHub repo (create one first on github.com)
git remote add origin https://github.com/YOUR_USERNAME/gmail-automation.git

# Push
git push -u origin main
```

---

## 🖥️ Step 2: Deploy Backend on Render

### 2.1 Create Backend Service

1. Go to **https://dashboard.render.com/**
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repo
4. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `gmail-automation-api` |
| **Region** | Oregon (US West) |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npx prisma generate && npm run build` |
| **Start Command** | `npx prisma migrate deploy && npm start` |
| **Instance Type** | Free |

### 2.2 Add Environment Variables (Backend)

Click **"Advanced"** → **"Add Environment Variable"**

Copy these from your `backend/.env`:

| Key | Value (from your .env) |
|-----|------------------------|
| `NODE_ENV` | `production` |
| `PORT` | `3002` |
| `DATABASE_URL` | `postgresql://neondb_owner:npg_Wah4...` (your Neon URL) |
| `JWT_SECRET` | `change-this-to-a-secure-random-string-at-least-32-characters-long` |
| `GMAIL_CLIENT_ID` | `22540028343-c5jde...apps.googleusercontent.com` |
| `GMAIL_CLIENT_SECRET` | `GOCSPX-GOCSPX-gq6n0r76...` |
| `GMAIL_REDIRECT_URI` | `https://gmail-automation-api.onrender.com/api/email-accounts/callback` ⚠️ |
| `FRONTEND_URL` | `https://gmail-automation-frontend.onrender.com` ⚠️ |

> ⚠️ **Important**: The GMAIL_REDIRECT_URI and FRONTEND_URL will use your actual Render URLs after deployment!

5. Click **"Create Web Service"**

6. **Wait for deployment** (takes 2-5 minutes)

7. **Copy your backend URL**: `https://gmail-automation-api.onrender.com`

---

## 🎨 Step 3: Deploy Frontend on Render

### 3.1 Create Frontend Service

1. Click **"New +"** → **"Static Site"**
2. Connect the same GitHub repo
3. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `gmail-automation-frontend` |
| **Branch** | `main` |
| **Root Directory** | `frontend` |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `dist` |

### 3.2 Add Environment Variable (Frontend)

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://gmail-automation-api.onrender.com` |

> Use your actual backend URL from Step 2!

4. Click **"Create Static Site"**

5. **Copy your frontend URL**: `https://gmail-automation-frontend.onrender.com`

---

## 🔐 Step 4: Update Google Cloud Console

### 4.1 Add Production URLs

1. Go to **https://console.cloud.google.com/**
2. Select your project: **Gmail Automation**
3. Go to **"APIs & Services"** → **"Credentials"**
4. Click on your **OAuth 2.0 Client ID**

### 4.2 Update Authorized JavaScript Origins

Add these (keep localhost for local dev):
```
http://localhost:3001
http://localhost:3000
https://gmail-automation-frontend.onrender.com
```

### 4.3 Update Authorized Redirect URIs

Add these:
```
http://localhost:3002/api/email-accounts/callback
https://gmail-automation-api.onrender.com/api/email-accounts/callback
```

5. Click **"Save"**

---

## 🔄 Step 5: Update Backend Environment Variable

Now that you have both URLs, go back to Render:

1. Go to your **Backend** service
2. Click **"Environment"**
3. Update these variables with your actual URLs:

| Key | Value |
|-----|-------|
| `GMAIL_REDIRECT_URI` | `https://gmail-automation-api.onrender.com/api/email-accounts/callback` |
| `FRONTEND_URL` | `https://gmail-automation-frontend.onrender.com` |

4. Click **"Save Changes"** (backend will redeploy)

---

## ✅ Step 6: Test Your Deployment

1. Open your frontend URL: `https://gmail-automation-frontend.onrender.com`
2. Register a new account
3. Try connecting Gmail
4. Create a rule and test!

---

## 📝 Quick Reference: Your URLs

After deployment, save these URLs:

| Service | URL |
|---------|-----|
| **Frontend** | `https://gmail-automation-frontend.onrender.com` |
| **Backend API** | `https://gmail-automation-api.onrender.com` |
| **Gmail Callback** | `https://gmail-automation-api.onrender.com/api/email-accounts/callback` |

---

## ⚠️ Important Notes

### Free Tier Limitations
- Backend **spins down after 15 minutes of inactivity**
- First request after sleep takes ~30 seconds
- Email polling stops when backend is asleep

### To Keep Backend Awake (Optional)
Use a free cron service like https://cron-job.org to ping your backend every 14 minutes:
```
URL: https://gmail-automation-api.onrender.com/api/health
Interval: Every 14 minutes
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "502 Bad Gateway" | Wait 30 seconds, backend is waking up |
| "CORS error" | Check FRONTEND_URL env variable matches exactly |
| "OAuth redirect mismatch" | Update Google Cloud Console with exact Render URLs |
| "Database error" | Check DATABASE_URL is correctly copied |
| Build fails | Check Render logs for specific error |

---

## 📁 Environment Variables Summary

### Backend (.env → Render Environment)
```
NODE_ENV=production
PORT=3002
DATABASE_URL=<your-neon-database-url>
JWT_SECRET=<your-jwt-secret>
GMAIL_CLIENT_ID=<your-google-client-id>
GMAIL_CLIENT_SECRET=<your-google-client-secret>
GMAIL_REDIRECT_URI=https://<your-backend>.onrender.com/api/email-accounts/callback
FRONTEND_URL=https://<your-frontend>.onrender.com
```

### Frontend (Render Environment)
```
VITE_API_URL=https://<your-backend>.onrender.com
```

---

## 🎉 Done!

Your Gmail Automation system is now live on the internet!

Share your frontend URL with others to use the app.

# Email Automation System - Complete Setup Guide

## 🚀 Quick Start (5 Minutes)

### Prerequisites

Before starting, ensure you have:
- **Node.js** 18+ and npm 9+ installed
- **Docker** and **Docker Compose** installed
- **Gmail API credentials** from Google Cloud Console

### Step 1: Gmail API Setup (Most Important!)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Gmail API:
   - Go to "APIs & Services" > "Library"
   - Search for "Gmail API"
   - Click "Enable"

4. Create OAuth 2.0 Credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URI: `http://localhost:3001/api/auth/gmail/callback`
   - For production, add: `https://yourdomain.com/api/auth/gmail/callback`
   - Download the credentials JSON

5. Note your:
   - Client ID
   - Client Secret

### Step 2: Project Setup

```bash
cd Gmail-Automation

# Copy environment template
cp .env.example .env

# Edit .env with your Gmail API credentials
notepad .env  # On Windows
# or
nano .env     # On Linux/Mac
```

**IMPORTANT**: Edit `.env` and add your Gmail API credentials:

```env
# Database
DB_PASSWORD=your_secure_password_here

# Gmail API (REQUIRED - Get from Google Cloud Console)
GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-client-secret

# JWT Secret (Change this!)
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters
```

### Step 3: Start the Application

```bash
# Install root dependencies
npm install

# Start all services with Docker
docker-compose up -d

# Or start in foreground to see logs
docker-compose up
```

This will start:
- PostgreSQL database (port 5432)
- Redis (port 6379)
- Backend API (port 3001)
- Frontend UI (port 3000)
- Background worker

### Step 4: Access the Application

1. Open your browser to: **http://localhost:3000**
2. Register a new account
3. Log in
4. Connect your Gmail account
5. Create automation rules
6. Watch orders get accepted automatically!

## 📁 Project Structure

```
Gmail-Automation/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Main server
│   │   ├── worker.ts             # Background worker
│   │   ├── routes/               # API endpoints
│   │   ├── services/             # Business logic
│   │   │   ├── gmail.service.ts  # Gmail API integration
│   │   │   ├── ruleMatching.service.ts   # Rule engine
│   │   │   └── orderAcceptance.service.ts # Order processing
│   │   ├── jobs/                 # Background jobs
│   │   │   └── processors/       # Job processors
│   │   ├── middleware/           # Express middleware
│   │   └── utils/                # Utilities
│   ├── prisma/
│   │   └── schema.prisma         # Database schema
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/                # React pages
│   │   ├── components/           # React components
│   │   ├── lib/                  # API client & utilities
│   │   └── stores/               # State management
│   └── package.json
├── docker-compose.yml
└── README.md
```

## 🔧 Development Mode

For local development without Docker:

### 1. Start Database and Redis

```bash
docker-compose up postgres redis -d
```

### 2. Setup Backend

```bash
cd backend
npm install

# Run database migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Start backend
npm run dev

# In another terminal, start worker
npm run worker
```

### 3. Setup Frontend

```bash
cd frontend
npm install

# Start development server
npm run dev
```

Access:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## 🗄️ Database Management

```bash
cd backend

# Create a new migration
npx prisma migrate dev --name your_migration_name

# View database in Prisma Studio
npx prisma studio

# Reset database (CAUTION: Deletes all data)
npx prisma migrate reset

# Deploy migrations to production
npx prisma migrate deploy
```

## 🔍 Monitoring & Debugging

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f worker
docker-compose logs -f postgres
```

### Check Service Status

```bash
docker-compose ps
```

### Access Database

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U postgres -d email_automation

# View tables
\dt

# View data
SELECT * FROM users;
SELECT * FROM email_accounts;
SELECT * FROM processed_emails;
```

### Access Redis CLI

```bash
docker-compose exec redis redis-cli

# View queues
KEYS *
LLEN bull:email-check:wait
```

## 🌐 Production Deployment

### Environment Variables for Production

Create a `.env.production` file:

```env
NODE_ENV=production

# Database (use managed database)
DATABASE_URL=postgresql://user:password@your-db-host:5432/email_automation

# Redis (use managed Redis)
REDIS_URL=redis://your-redis-host:6379

# JWT Secret (use a strong, random secret)
JWT_SECRET=your-production-secret-minimum-64-characters

# Gmail API
GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REDIRECT_URI=https://yourdomain.com/api/auth/gmail/callback

# Application URLs
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://api.yourdomain.com
```

### AWS Deployment Example

#### 1. Build and Push Docker Images

```bash
# Login to AWS ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build images
docker-compose build

# Tag and push backend
docker tag gmail-automation-backend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/email-automation-backend:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/email-automation-backend:latest

# Tag and push frontend
docker tag gmail-automation-frontend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/email-automation-frontend:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/email-automation-frontend:latest
```

#### 2. Set Up Infrastructure

**RDS PostgreSQL:**
- Create an RDS PostgreSQL instance
- Note the connection URL

**ElastiCache Redis:**
- Create an ElastiCache Redis cluster
- Note the Redis URL

**ECS/Fargate:**
- Create ECS cluster
- Create task definitions for backend, worker, and frontend
- Create services with desired count
- Configure load balancer
- Set environment variables

#### 3. Deploy

```bash
# Run migrations
docker run --rm -e DATABASE_URL="your-production-db-url" \
  your-backend-image npx prisma migrate deploy

# Deploy services
aws ecs update-service --cluster your-cluster --service backend --force-new-deployment
aws ecs update-service --cluster your-cluster --service worker --force-new-deployment
aws ecs update-service --cluster your-cluster --service frontend --force-new-deployment
```

### Google Cloud Platform Deployment

Use Cloud Run for serverless deployment:

```bash
# Backend
gcloud run deploy email-automation-backend \
  --image gcr.io/your-project/backend \
  --platform managed \
  --region us-central1 \
  --set-env-vars="DATABASE_URL=...,REDIS_URL=..."

# Frontend
gcloud run deploy email-automation-frontend \
  --image gcr.io/your-project/frontend \
  --platform managed \
  --region us-central1
```

## 🔐 Security Checklist

- [ ] Change all default passwords
- [ ] Use strong JWT secret (minimum 64 characters)
- [ ] Enable HTTPS in production
- [ ] Set up proper CORS origins
- [ ] Use managed database with backups
- [ ] Enable database SSL/TLS
- [ ] Rotate Gmail API credentials regularly
- [ ] Set up rate limiting
- [ ] Enable logging and monitoring
- [ ] Regular security updates

## 🐛 Troubleshooting

### Gmail API Connection Issues

**Problem**: "Failed to connect Gmail account"

**Solutions**:
1. Verify Gmail API is enabled in Google Cloud Console
2. Check OAuth redirect URI matches exactly
3. Ensure credentials are correct in `.env`
4. Check if tokens need refresh

### Database Connection Issues

**Problem**: "Database connection failed"

**Solutions**:
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Test connection
docker-compose exec postgres pg_isready
```

### Worker Not Processing Emails

**Problem**: Emails not being checked

**Solutions**:
1. Check worker logs: `docker-compose logs worker`
2. Verify Redis is running: `docker-compose ps redis`
3. Check email account is active in UI
4. Verify token hasn't expired

### Port Already in Use

**Problem**: "Port 3000/3001 already in use"

**Solutions**:
```bash
# Find process using port
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # Mac/Linux

# Stop Docker services
docker-compose down

# Change ports in docker-compose.yml if needed
```

## 📊 Performance Tuning

### Email Check Frequency

Edit `backend/src/jobs/index.ts`:

```typescript
// Check every 30 seconds (default)
cron.schedule('*/30 * * * * *', ...)

// Check every minute
cron.schedule('* * * * *', ...)

// Check every 5 minutes
cron.schedule('*/5 * * * *', ...)
```

### Worker Concurrency

Edit `backend/src/jobs/index.ts`:

```typescript
// Process 5 email checks concurrently (default)
emailCheckQueue.process('check-inbox', 5, processEmailCheck);

// Increase to 10 for faster processing
emailCheckQueue.process('check-inbox', 10, processEmailCheck);
```

### Database Performance

```sql
-- Add indexes for faster queries
CREATE INDEX idx_processed_emails_received_at ON processed_emails(received_at DESC);
CREATE INDEX idx_processed_emails_email_account_status ON processed_emails(email_account_id, status);
```

## 🔄 Backup and Restore

### Backup Database

```bash
# Manual backup
docker-compose exec postgres pg_dump -U postgres email_automation > backup.sql

# Automated daily backup (add to cron)
0 2 * * * docker-compose exec postgres pg_dump -U postgres email_automation > /backups/backup_$(date +\%Y\%m\%d).sql
```

### Restore Database

```bash
cat backup.sql | docker-compose exec -T postgres psql -U postgres email_automation
```

## 📞 Support

For issues and questions:
1. Check the troubleshooting section above
2. Review application logs
3. Check database and Redis connectivity
4. Verify Gmail API credentials and permissions

## 🎉 Success!

If everything is set up correctly, you should see:
- ✅ Application accessible at http://localhost:3000
- ✅ Able to register and login
- ✅ Gmail account connects successfully
- ✅ Rules can be created
- ✅ Emails are being monitored (check worker logs)
- ✅ Orders are accepted automatically

**The system is now running 24/7 and will automatically accept orders based on your rules!**

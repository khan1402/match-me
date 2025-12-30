# Match-Me Full Stack - Setup Guide

Complete guide to set up and run the Match-Me application with Golang backend and React frontend.

## 📋 Prerequisites

### System Requirements
- Docker & Docker Compose (recommended)
- OR manually:
  - Go 1.21+
  - Node.js 18+
  - PostgreSQL 12+

### Ports Required
- `3000` - React Frontend
- `8080` - Golang Backend API
- `5432` - PostgreSQL Database

---

## 🚀 Option 1: Docker Compose (Recommended - 5 minutes)

### 1. Start All Services
```bash
docker-compose up
```

This will:
- Start PostgreSQL database
- Run database migrations
- Start Golang backend (http://localhost:8080)
- Start React frontend (http://localhost:3000)

### 2. Seed Test Data (in another terminal)
```bash
docker exec match-me-backend go run cmd/seed/main.go
```

### 3. Access Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **WebSocket**: ws://localhost:8080/ws

### 4. Stop Services
```bash
docker-compose down
```

---

## 🛠️ Option 2: Manual Setup (15 minutes)

### Backend Setup

#### 1. Install Go Dependencies
```bash
cd backend
go mod download
go mod tidy
```

#### 2. Set Up PostgreSQL
```bash
# Create database
createdb matchme

# Create user
createuser matchme_user

# Set password
psql -U postgres -d matchme -c "ALTER USER matchme_user WITH PASSWORD 'matchme_password';"

# Verify connection
psql -U matchme_user -d matchme -c "SELECT 1;"
```

#### 3. Run Migrations
```bash
# Install migrate tool
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

# Run migrations
migrate -database "postgres://matchme_user:matchme_password@localhost:5432/matchme?sslmode=disable" \
        -path db/migrations up
```

#### 4. Seed Test Data
```bash
go run cmd/seed/main.go
```

#### 5. Start Backend
```bash
go run cmd/server/main.go
```

Backend will be available at `http://localhost:8080`

### Frontend Setup

#### 1. Install Dependencies
```bash
cd frontend
npm install
# or
pnpm install
```

#### 2. Create Environment File
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
VITE_API_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080
```

#### 3. Start Development Server
```bash
npm run dev
# or
pnpm dev
```

Frontend will be available at `http://localhost:3000`

---

## 🧪 Testing the Application

### 1. Register a New User
```bash
curl -X POST http://localhost:8080/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 2. Login
```bash
curl -X POST http://localhost:8080/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# Copy the token from response
export TOKEN="<token_from_response>"
```

### 3. Get Current User
```bash
curl -X GET http://localhost:8080/me \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Complete User Profile
```bash
curl -X PUT http://localhost:8080/me/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "age": 28,
    "gender": "male",
    "lookingFor": "female",
    "bio": "Love hiking and travel",
    "location": "New York, NY",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "maxDistanceKm": 50
  }'
```

### 5. Add Interests
```bash
curl -X PUT http://localhost:8080/me/bio \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "interests": ["hiking", "photography", "travel", "cooking", "music"]
  }'
```

### 6. Get Recommendations
```bash
curl -X GET http://localhost:8080/recommendations \
  -H "Authorization: Bearer $TOKEN"
```

### 7. Test WebSocket
```bash
# Using wscat
npm install -g wscat

wscat -c ws://localhost:8080/ws \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📊 Database Management

### View Database
```bash
psql -U matchme_user -d matchme
```

### Common Queries
```sql
-- Count users
SELECT COUNT(*) FROM users;

-- View all users
SELECT id, email, name FROM users LIMIT 10;

-- View profiles
SELECT * FROM profiles LIMIT 10;

-- View messages
SELECT * FROM messages LIMIT 10;

-- View matches
SELECT * FROM matches LIMIT 10;
```

### Reset Database
```bash
# Drop and recreate
dropdb matchme
createdb matchme

# Re-run migrations
migrate -database "postgres://matchme_user:matchme_password@localhost:5432/matchme?sslmode=disable" \
        -path backend/db/migrations up

# Re-seed data
cd backend && go run cmd/seed/main.go
```

---

## 🐛 Troubleshooting

### Backend Issues

#### Port 8080 Already in Use
```bash
# Find and kill process
lsof -ti:8080 | xargs kill -9

# Or change port in .env
PORT=8081
```

#### Database Connection Error
```bash
# Verify PostgreSQL is running
psql -U matchme_user -d matchme -c "SELECT 1;"

# Check .env database settings
cat backend/.env
```

#### Go Module Errors
```bash
cd backend
go clean -modcache
go mod tidy
go mod download
```

### Frontend Issues

#### Port 3000 Already in Use
```bash
npm run dev -- --port 3001
```

#### Module Not Found
```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

#### Build Errors
```bash
npm run build -- --force
```

### Docker Issues

#### Container Won't Start
```bash
# Check logs
docker-compose logs backend
docker-compose logs frontend
docker-compose logs postgres

# Rebuild images
docker-compose down
docker-compose up --build
```

#### Database Not Initialized
```bash
# Remove volume and restart
docker-compose down -v
docker-compose up
```

---

## 📝 Environment Variables

### Backend (.env)
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=matchme_user
DB_PASSWORD=matchme_password
DB_NAME=matchme

# Server
PORT=8080
GIN_MODE=debug  # or release for production

# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRATION=24h

# CORS
CORS_ORIGIN=http://localhost:3000
```

### Frontend (.env.local)
```env
VITE_API_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080
```

---

## 🚀 Production Deployment

### Backend Deployment

#### Build Docker Image
```bash
cd backend
docker build -t match-me-backend:latest .
```

#### Push to Registry
```bash
docker tag match-me-backend:latest your-registry/match-me-backend:latest
docker push your-registry/match-me-backend:latest
```

#### Deploy to Cloud
```bash
# AWS ECS
aws ecs create-service --cluster match-me --service-name backend ...

# Google Cloud Run
gcloud run deploy match-me-backend --image gcr.io/your-project/match-me-backend

# Azure App Service
az webapp create --resource-group match-me --plan match-me-plan --name match-me-backend
```

### Frontend Deployment

#### Build for Production
```bash
cd frontend
npm run build
```

#### Deploy to Hosting
```bash
# Vercel
vercel deploy

# Netlify
netlify deploy --prod --dir=dist

# AWS S3 + CloudFront
aws s3 sync dist/ s3://match-me-bucket/
```

---

## 📚 Additional Resources

### Backend Documentation
- `backend/README.md` - Complete backend guide
- `backend/QUICK_START.md` - Quick start guide
- `backend/TESTING_COMPLIANCE.md` - Requirements verification

### Frontend Documentation
- `frontend/README.md` - Frontend guide

### API Documentation
- See `backend/README.md` for all 38 API endpoints

---

## ✅ Verification Checklist

- [ ] Docker and Docker Compose installed
- [ ] Ports 3000, 8080, 5432 are available
- [ ] Git cloned the repository
- [ ] Extracted the zip file
- [ ] Read this setup guide
- [ ] Started services with `docker-compose up`
- [ ] Seeded test data
- [ ] Accessed frontend at http://localhost:3000
- [ ] Registered a test user
- [ ] Completed user profile
- [ ] Got recommendations
- [ ] Tested WebSocket connection

---

## 🎯 Next Steps

1. ✅ Complete setup following this guide
2. ✅ Test all endpoints
3. ✅ Explore the application
4. ✅ Review documentation
5. ✅ Customize for your needs
6. ✅ Deploy to production

---

## 📞 Support

### Quick Help
- **Backend**: See `backend/QUICK_START.md`
- **Frontend**: See `frontend/README.md`
- **Full Stack**: See `README.md`

### Common Issues
- Check Docker logs: `docker-compose logs`
- Verify database: `psql -U matchme_user -d matchme`
- Test API: `curl http://localhost:8080/register`

---

**Status**: ✅ Ready to Deploy
**Version**: 1.0.0
**Last Updated**: December 2024

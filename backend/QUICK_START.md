# Quick Start Guide - Match-Me Golang Backend

## 🚀 5-Minute Docker Setup

```bash
# 1. Clone repository
git clone <repo>
cd match-me-go

# 2. Copy environment file
cp .env.example .env

# 3. Start with Docker Compose
docker-compose up

# 4. Seed test data (in another terminal)
docker exec match-me-backend go run cmd/seed/main.go

# 5. Test the API
curl -X POST http://localhost:8080/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

## 🛠️ Manual Setup (15 minutes)

### Prerequisites
- Go 1.21+
- PostgreSQL 12+

### Steps

```bash
# 1. Install dependencies
go mod download
go mod tidy

# 2. Create database
createdb matchme
createuser matchme_user
psql -U postgres -d matchme -c "ALTER USER matchme_user WITH PASSWORD 'matchme_password';"

# 3. Run migrations
migrate -database "postgres://matchme_user:matchme_password@localhost:5432/matchme?sslmode=disable" \
        -path db/migrations up

# 4. Seed test data
go run cmd/seed/main.go

# 5. Start server
go run cmd/server/main.go

# Server runs on http://localhost:8080
```

## 📝 Common Commands

### Development
```bash
# Run server
go run cmd/server/main.go

# Run tests
go test ./...

# Format code
go fmt ./...

# Check for issues
go vet ./...

# Build binary
go build -o match-me cmd/server/main.go
```

### Database
```bash
# Run migrations
migrate -database "postgres://..." -path db/migrations up

# Rollback migrations
migrate -database "postgres://..." -path db/migrations down

# Seed test data
go run cmd/seed/main.go

# Connect to database
psql -U matchme_user -d matchme
```

### Docker
```bash
# Build image
docker build -t match-me-go .

# Run container
docker run -p 8080:8080 match-me-go

# Start with Compose
docker-compose up

# Stop services
docker-compose down

# View logs
docker-compose logs -f backend
```

## 🔌 API Quick Test

### Register User
```bash
curl -X POST http://localhost:8080/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### Login
```bash
curl -X POST http://localhost:8080/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'

# Copy the token from response
export TOKEN="<token_from_response>"
```

### Get Current User
```bash
curl -X GET http://localhost:8080/me \
  -H "Authorization: Bearer $TOKEN"
```

### Get Recommendations
```bash
curl -X GET http://localhost:8080/recommendations \
  -H "Authorization: Bearer $TOKEN"
```

### WebSocket Connection
```bash
# Using wscat
wscat -c ws://localhost:8080/ws \
  -H "Authorization: Bearer $TOKEN"

# Or using websocat
websocat ws://localhost:8080/ws
```

## 📚 Documentation

- **README.md** - Complete setup and usage guide
- **BACKEND_CONVERSION.md** - Detailed architecture and conversion notes
- **TESTING_COMPLIANCE.md** - Testing criteria verification
- **PROJECT_SUMMARY.md** - Project overview and deliverables

## 🐛 Troubleshooting

### Port 8080 already in use
```bash
# Change port in .env
PORT=8081

# Or kill process
lsof -ti:8080 | xargs kill -9
```

### Database connection error
```bash
# Check PostgreSQL is running
psql -U matchme_user -d matchme -c "SELECT 1;"

# Verify .env database settings
```

### Go module errors
```bash
# Clean cache and re-download
go clean -modcache
go mod tidy
go mod download
```

## 📊 Verify Installation

```bash
# Check Go version
go version

# Check PostgreSQL
psql --version

# Check database
psql -U matchme_user -d matchme -c "SELECT COUNT(*) FROM users;"

# Test API
curl http://localhost:8080/register
```

## 🎯 Next Steps

1. ✅ Start the server
2. ✅ Register a test user
3. ✅ Complete user profile
4. ✅ Get recommendations
5. ✅ Send connection requests
6. ✅ Test chat with WebSocket

## 💡 Tips

- Use Postman or Insomnia for API testing
- Use `wscat` for WebSocket testing
- Check logs with `docker-compose logs -f`
- Database is in `/var/lib/postgresql/data` in Docker
- All endpoints require authentication except `/register` and `/login`

## 📞 Support

For issues:
1. Check logs: `docker-compose logs backend`
2. Verify database: `psql -U matchme_user -d matchme`
3. Test connectivity: `curl http://localhost:8080/register`
4. Check .env file configuration

---

**Ready to go!** 🚀

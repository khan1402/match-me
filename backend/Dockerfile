# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application to /out/server
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/server cmd/server/main.go

# Runtime stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates postgresql-client

# Copy binary to /usr/local/bin/server
COPY --from=builder /out/server /usr/local/bin/server
RUN chmod +x /usr/local/bin/server

EXPOSE 8080
CMD ["server"]


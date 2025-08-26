# Content Delivery Service Makefile

.PHONY: help build run dev test clean docker-build docker-run deps lint fmt vet

# Default target
help:
	@echo "Content Delivery Service - Available Commands:"
	@echo "  build       - Build the application binary"
	@echo "  run         - Run the application"
	@echo "  dev         - Run with hot reload using Air"
	@echo "  test        - Run all tests"
	@echo "  test-coverage - Run tests with coverage"
	@echo "  deps        - Download dependencies"
	@echo "  lint        - Run linting"
	@echo "  fmt         - Format code"
	@echo "  vet         - Run go vet"
	@echo "  clean       - Clean build artifacts"
	@echo "  docker-build - Build Docker image"
	@echo "  docker-run  - Run Docker container"

# Build the application
build:
	@echo "Building Content Delivery Service..."
	@go build -o bin/content-delivery ./src

# Run the application
run:
	@echo "Starting Content Delivery Service..."
	@go run ./src

# Development with hot reload
dev:
	@echo "Starting development server with hot reload..."
	@air

# Download dependencies
deps:
	@echo "Downloading dependencies..."
	@go mod tidy
	@go mod download

# Run tests
test:
	@echo "Running tests..."
	@go test -v ./...

# Run tests with coverage
test-coverage:
	@echo "Running tests with coverage..."
	@go test -v -cover ./...
	@go test -coverprofile=coverage.out ./...
	@go tool cover -html=coverage.out -o coverage.html

# Format code
fmt:
	@echo "Formatting code..."
	@go fmt ./...

# Run go vet
vet:
	@echo "Running go vet..."
	@go vet ./...

# Run linting
lint:
	@echo "Running golangci-lint..."
	@golangci-lint run

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf bin/
	@rm -f coverage.out coverage.html

# Build Docker image
docker-build:
	@echo "Building Docker image..."
	@docker build -t content-delivery:latest .

# Run Docker container
docker-run:
	@echo "Running Docker container..."
	@docker run -p 8084:8084 --env-file .env content-delivery:latest

# Development setup
setup-dev:
	@echo "Setting up development environment..."
	@cp .env.example .env
	@echo "Please edit .env file with your configuration"

# Database migrations (when implemented)
migrate:
	@echo "Running database migrations..."
	@go run cmd/migrate/main.go

# Start PostgreSQL and Redis with Docker Compose
start-deps:
	@echo "Starting dependencies..."
	@docker-compose up -d postgres redis minio

# Stop dependencies
stop-deps:
	@echo "Stopping dependencies..."
	@docker-compose down

# Check service health
health:
	@echo "Checking service health..."
	@curl -s http://localhost:8084/health | jq .

# Check readiness
ready:
	@echo "Checking service readiness..."
	@curl -s http://localhost:8084/health/ready | jq .

# Install development tools
install-tools:
	@echo "Installing development tools..."
	@go install github.com/cosmtrek/air@latest
	@go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
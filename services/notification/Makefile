# Makefile for Modex Notification Service

# Variables
NODE = node
NPM = npm
NODEMON = npx nodemon
TS_NODE = npx ts-node
APP_NAME = notification-service

# Default target
.PHONY: all
all: help

# Help
.PHONY: help
help:
	@echo "Modex Notification Service"
	@echo ""
	@echo "Usage:"
	@echo "  make dev            - Start development server with hot reloading"
	@echo "  make build          - Build the application for production"
	@echo "  make start          - Start the application in production mode"
	@echo "  make clean          - Remove build artifacts"
	@echo "  make lint           - Run linter"
	@echo "  make test           - Run tests"
	@echo "  make migrate        - Run database migrations"
	@echo "  make migrate-novu   - Run Novu-specific migrations"
	@echo "  make install        - Install dependencies"

# Development
.PHONY: dev
dev:
	@echo "Starting development server..."
	$(NPM) run dev

# Build
.PHONY: build
build:
	@echo "Building for production..."
	$(NPM) run build

# Start production
.PHONY: start
start:
	@echo "Starting in production mode..."
	$(NPM) run start

# Clean
.PHONY: clean
clean:
	@echo "Cleaning build artifacts..."
	rm -rf dist
	rm -rf node_modules/.cache

# Lint
.PHONY: lint
lint:
	@echo "Running linter..."
	$(NPM) run lint

# Test
.PHONY: test
test:
	@echo "Running tests..."
	$(NPM) run test

# Database migrations
.PHONY: migrate
migrate:
	@echo "Running database migrations..."
	$(NPM) run migrate

# Novu migrations
.PHONY: migrate-novu
migrate-novu:
	@echo "Running Novu migrations..."
	$(NPM) run migrate:novu

# Install dependencies
.PHONY: install
install:
	@echo "Installing dependencies..."
	$(NPM) install

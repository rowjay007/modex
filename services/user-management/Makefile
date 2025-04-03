.PHONY: setup dev build test lint format migrate generate-migration clean

setup:
	@cp -n .env.example .env || true
	npm install

# Development
dev:
	npm run dev

# Build
build:
	npm run build

# Testing
test:
	npm run test

test-watch:
	npm run test:watch

test-coverage:
	npm run test:coverage

# Code Quality
lint:
	npm run lint

lint-fix:
	npm run lint:fix

format:
	npm run format

# Database
migrate:
	npx drizzle-kit push:pg

generate-migration:
	npx drizzle-kit generate:pg

# Cleanup
clean:
	rm -rf dist
	rm -rf node_modules

# Default
default: setup
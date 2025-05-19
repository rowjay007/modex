.PHONY: install dev build start test lint format clean

install:
	npm install

dev:
	npm run dev

build:
	npm run build

start:
	npm start

test:
	npm test

lint:
	npm run lint

format:
	npm run format

clean:
	rm -rf dist node_modules

# Database commands
db-push:
	npx drizzle-kit push:pg

db-studio:
	npx drizzle-kit studio
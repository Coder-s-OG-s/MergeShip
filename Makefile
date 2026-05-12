.PHONY: help dev install supabase-start supabase-stop db-reset db-seed db-studio test test-watch test-coverage lint typecheck format build clean sim-webhook

help:
	@echo "MergeShip — common tasks"
	@echo ""
	@echo "  make dev             Run the full local stack (supabase + next dev)"
	@echo "  make install         npm install"
	@echo "  make supabase-start  Start local Supabase (Postgres, Auth, Studio in Docker)"
	@echo "  make supabase-stop   Stop local Supabase"
	@echo "  make db-reset        Drop, migrate, re-seed local DB"
	@echo "  make db-seed         Run seed script only"
	@echo "  make db-studio       Open Drizzle Studio (DB GUI)"
	@echo "  make test            Run all tests once"
	@echo "  make test-watch      Run tests in watch mode (TDD)"
	@echo "  make test-coverage   Run tests + coverage gate"
	@echo "  make lint            ESLint"
	@echo "  make typecheck       TypeScript no-emit"
	@echo "  make format          Prettier write"
	@echo "  make build           next build"
	@echo "  make sim-webhook     Fire a mock GitHub webhook (interactive)"
	@echo "  make clean           Remove .next + node_modules + supabase volume"

install:
	npm install

supabase-start:
	npx supabase start

supabase-stop:
	npx supabase stop

dev: supabase-start
	@echo "✅ Supabase running. Starting Next.js dev server..."
	npm run dev

db-seed:
	npm run db:seed

db-reset:
	npx supabase db reset
	npm run db:seed

db-studio:
	npm run db:studio

test:
	npm test

test-watch:
	npm run test:watch

test-coverage:
	npm run test:coverage

lint:
	npm run lint

typecheck:
	npm run typecheck

format:
	npm run format

build:
	npm run build

sim-webhook:
	npm run sim:webhook

clean:
	rm -rf .next node_modules
	npx supabase stop --no-backup || true

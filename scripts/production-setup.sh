#!/bin/bash
set -e

echo "=== Cafe POS Production Setup ==="

# Check required env vars
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not set"
  exit 1
fi

if [ -z "$AUTH_SECRET" ]; then
  echo "ERROR: AUTH_SECRET not set"
  exit 1
fi

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Run migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Seed database (optional, only if SEED_DB=true)
if [ "$SEED_DB" = "true" ]; then
  echo "Seeding database..."
  npx tsx prisma/seed.ts
fi

echo "=== Setup complete ==="
echo "Run 'npm start' to start the production server"

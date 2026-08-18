#!/bin/bash
set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/cafe_pos_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not set"
  exit 1
fi

echo "Backing up database..."
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"

# Keep only last 30 backups
cd "$BACKUP_DIR"
ls -t cafe_pos_*.sql.gz | tail -n +31 | xargs -r rm

echo "Backup saved: $BACKUP_FILE"
ls -lh "$BACKUP_FILE"

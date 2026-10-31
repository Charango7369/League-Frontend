#!/bin/bash
set -e

BACKUP_DIR="$(dirname "$0")/../backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/apolo_backup_${TIMESTAMP}.sql"

echo "💾 Generando respaldo de base de datos ApoloDigital League..."
docker exec -t apolo_postgres pg_dump -U postgres apolodigital_league > "$BACKUP_FILE"

echo "✅ Respaldo guardado exitosamente en: $BACKUP_FILE"
# Keep only last 14 days of backups
find "$BACKUP_DIR" -type f -name "apolo_backup_*.sql" -mtime +14 -delete

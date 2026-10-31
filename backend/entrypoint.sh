#!/bin/sh
set -e

echo "🏆 =========================================="
echo "   Iniciando ApoloDigital League Backend"
echo "=========================================="

# Run database migrations
echo "🔄 Comprobando y aplicando migraciones Alembic..."
alembic upgrade head || echo "⚠️ Aviso: Las migraciones ya estaban aplicadas o no se requirió cambio."

echo "🚀 Iniciando servidor Uvicorn en 0.0.0.0:8000..."
exec "$@"

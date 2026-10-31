#!/bin/bash
set -e

echo "🏆 ========================================================="
echo "   ApoloDigital League — Script de Despliegue en Producción"
echo "   Identidad Apolodigital · Provincia Franz Tamayo, La Paz"
echo "========================================================="

# Check docker & docker compose
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker no está instalado en este servidor."
    exit 1
fi

# Setup .env if not exists
if [ ! -f .env ]; then
    echo "⚙️ Creando archivo .env a partir de .env.production.example..."
    cp .env.production.example .env
fi

echo "📦 1. Compilando y empaquetando imágenes Docker (Multi-stage build)..."
docker compose build

echo "🚀 2. Levantando servicios en segundo plano..."
docker compose up -d

echo "⏳ 3. Esperando que los contenedores reporten estado saludable..."
sleep 6

echo "📊 4. Estado de los contenedores:"
docker compose ps

echo "✅ Despliegue completado con éxito."
echo "   • Aplicación Web Nginx: http://localhost:80"
echo "   • API Backend FastAPI:   http://localhost:8000/docs"
echo "   • Base de Datos Postgres: Puerto 5435"

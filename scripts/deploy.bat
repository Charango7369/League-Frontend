@echo off
chcp 65001 > nul
title ApoloDigital League - Despliegue en Produccion (Docker)

echo =========================================================
echo    ApoloDigital League - Despliegue en Produccion
echo    Identidad Apolodigital · Provincia Franz Tamayo, La Paz
echo =========================================================
echo.

where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Docker no esta instalado o no se encuentra en el PATH.
    pause
    exit /b 1
)

cd /d "%~dp0\.."

if not exist .env (
    echo [INFO] Creando archivo .env desde .env.production.example...
    copy .env.production.example .env > nul
)

echo [1/3] Compilando imagenes Docker (Multi-stage Frontend + Backend)...
docker compose build
if %errorlevel% neq 0 (
    echo [ERROR] Error durante la construccion de imagenes.
    pause
    exit /b 1
)

echo.
echo [2/3] Levantando contenedores en segundo plano...
docker compose up -d

echo.
echo [3/3] Verificando estado de los servicios...
timeout /t 5 > nul
docker compose ps

echo.
echo =========================================================
echo  Despliegue finalizado con exito!
echo   * Web Frontend: http://localhost:80
echo   * Backend API:  http://localhost:8000/docs
echo =========================================================
pause

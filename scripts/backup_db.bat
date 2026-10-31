@echo off
chcp 65001 > nul
title ApoloDigital League - Respaldo de Base de Datos

echo =========================================================
echo    ApoloDigital League - Copia de Seguridad (PostgreSQL)
echo =========================================================

set BACKUP_DIR=%~dp0..\backups
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

for /f %%a in ('powershell -Command "Get-Date -Format 'yyyyMMdd_HHmmss'"') do set TIMESTAMP=%%a
set BACKUP_FILE=%BACKUP_DIR%\apolo_backup_%TIMESTAMP%.sql

echo Generando respaldo en: %BACKUP_FILE%
docker exec -t apolo_postgres pg_dump -U postgres apolodigital_league > "%BACKUP_FILE%"

if %errorlevel% equ 0 (
    echo [OK] Copia de seguridad completada con exito.
) else (
    echo [ERROR] No se pudo generar la copia de seguridad. Verifique que apolo_postgres este en ejecucion.
)

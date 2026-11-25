@echo off
chcp 65001 >nul
title Proyecto Viaje
cd /d "%~dp0"

echo ==========================================
echo           PROYECTO VIAJE (PC)
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se ha encontrado Node.js.
  echo Instala la version LTS desde https://nodejs.org y vuelve a abrir este archivo.
  start "" https://nodejs.org
  pause
  exit /b 1
)

if exist ".git" (
  where git >nul 2>nul
  if not errorlevel 1 (
    echo Buscando actualizaciones...
    git pull --ff-only
    echo.
  )
)

if not exist "node_modules\expo" (
  echo Instalando dependencias. La primera vez tarda unos minutos...
  call npm install
  if errorlevel 1 (
    echo [ERROR] Fallo la instalacion de dependencias.
    pause
    exit /b 1
  )
) else (
  call npm install --no-audit --no-fund >nul 2>nul
)

echo.
echo Abriendo la app en el navegador: http://localhost:8081
echo Para cerrarla, cierra esta ventana o pulsa Ctrl+C.
echo.
call npx expo start --web --port 8081
pause

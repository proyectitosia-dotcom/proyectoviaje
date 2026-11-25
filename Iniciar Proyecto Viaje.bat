@echo off
setlocal
chcp 65001 >nul
title Proyecto Viaje
cd /d "%~dp0"

set "BRANCH=claude/lucid-mayer-vak935"
set "ZIPURL=https://github.com/proyectitosia-dotcom/proyectoviaje/archive/refs/heads/%BRANCH%.zip"

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

rem ---- 1. Actualizar el codigo a la ultima version ----
set "UPDATED=0"
if exist ".git" (
  where git >nul 2>nul
  if not errorlevel 1 (
    echo Buscando actualizaciones con git...
    git fetch origin %BRANCH% && git merge --ff-only FETCH_HEAD
    if errorlevel 1 (
      echo [AVISO] No se pudo actualizar con git ^(tienes cambios locales o hay conflictos^). Se usa la version actual.
    ) else (
      set "UPDATED=1"
    )
    echo.
  )
)
if "%UPDATED%"=="0" if not exist ".git" (
  echo Descargando la ultima version desde GitHub...
  if exist "%TEMP%\pv_update" rmdir /s /q "%TEMP%\pv_update"
  mkdir "%TEMP%\pv_update"
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { [Net.ServicePointManager]::SecurityProtocol = 'Tls12'; Invoke-WebRequest -UseBasicParsing -Uri '%ZIPURL%' -OutFile '%TEMP%\pv_update\p.zip'; Expand-Archive -Force '%TEMP%\pv_update\p.zip' '%TEMP%\pv_update\x'; exit 0 } catch { exit 1 }"
  if errorlevel 1 (
    echo [AVISO] No se pudo descargar la actualizacion. Se usa la version actual.
  ) else (
    for /d %%D in ("%TEMP%\pv_update\x\*") do robocopy "%%D" "%~dp0." /E /XD node_modules .expo .git /XF "Iniciar Proyecto Viaje.bat" /NFL /NDL /NJH /NJS /NP >nul
    echo Codigo actualizado.
  )
  rmdir /s /q "%TEMP%\pv_update" >nul 2>nul
  echo.
)

rem ---- Version instalada ----
if exist ".git" (
  where git >nul 2>nul
  if not errorlevel 1 for /f "delims=" %%V in ('git log -1 --format^=%%h' ) do echo Version: %%V
)

rem ---- 2. Instalar dependencias ----
if not exist "node_modules\expo" (
  echo Instalando dependencias. La primera vez tarda unos minutos...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo [ERROR] Fallo la instalacion de dependencias.
    pause
    exit /b 1
  )
) else (
  echo Comprobando dependencias...
  call npm install --no-audit --no-fund >nul 2>nul
)

rem ---- 3. Arrancar la app ----
echo.
echo Abriendo la app en el navegador: http://localhost:8081
echo Para cerrarla, cierra esta ventana o pulsa Ctrl+C.
echo.
call npx expo start --web --port 8081 --clear
pause

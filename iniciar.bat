@echo off
title Noche de Genios
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando por primera vez, espera un minuto...
  call npm install
)
node server.js
pause

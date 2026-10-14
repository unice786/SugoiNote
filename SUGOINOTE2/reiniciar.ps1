# Detiene todo y vuelve a levantar la API y Expo.
# Uso:  powershell -ExecutionPolicy Bypass -File .\reiniciar.ps1
#
# Util cuando: el puerto 5199 dice "address already in use", Expo se queda
# en el 8082, o la app muestra una pantalla en blanco tras cambiar codigo.

$ErrorActionPreference = 'Continue'

Write-Host ''
Write-Host '  Reiniciando el entorno de desarrollo...' -ForegroundColor Cyan
Write-Host ''

# 1. Detener
& (Join-Path $PSScriptRoot 'detener.ps1')

Write-Host '  Esperando a que se liberen los puertos...'
Start-Sleep -Seconds 4

# 2. Volver a levantar
& (Join-Path $PSScriptRoot 'iniciar.ps1')
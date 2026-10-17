# Levanta la API (.NET) y el servidor de Expo en dos ventanas separadas.
# Uso:  powershell -ExecutionPolicy Bypass -File .\iniciar.ps1
#
# Cada proceso corre en su propia ventana: asi ves los logs y los cerrabas con Ctrl+C.

$ErrorActionPreference = 'Continue'

$raiz    = $PSScriptRoot
$carpetaMovil = Join-Path $raiz 'mobile'
$ip      = (Get-NetIPAddress -AddressFamily IPv4 |
            Where-Object { $_.IPAddress -like '192.168.*' -and $_.IPAddress -notlike '169.254*' } |
            Select-Object -First 1).IPAddress

Write-Host ''
Write-Host '  ==============================================' -ForegroundColor Cyan
Write-Host '            SUGOINOTE - entorno de desarrollo' -ForegroundColor Cyan
Write-Host '  ==============================================' -ForegroundColor Cyan
Write-Host ''
Write-Host "  Tu IP de red : $ip"
Write-Host ''

# Avisa si la IP guardada en el cliente movil ya no es la tuya.
$archivoApi = Join-Path $carpetaMovil 'src\api\client.ts'
if ((Test-Path $archivoApi) -and $ip) {
    $configurada = ([regex]::Match((Get-Content $archivoApi -Raw), "API_BASE_POR_DEFECTO\s*=\s*'http://([\d\.]+):\d+'")).Groups[1].Value
    if ($configurada -and $configurada -ne $ip) {
        Write-Host "  AVISO: el celular apunta a $configurada pero tu IP ahora es $ip." -ForegroundColor Yellow
        Write-Host "         Edita mobile\src\api\client.ts (API_BASE_POR_DEFECTO) o la app no encontrara la API." -ForegroundColor Yellow
        Write-Host ''
    }
}

# 1) API en todas las interfaces (si escucha en localhost el celular no la alcanza)
Write-Host '  [1/2] Iniciando la API en http://0.0.0.0:5199 ...' -ForegroundColor Green
Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$raiz'; dotnet run --launch-profile celular"

Start-Sleep -Seconds 18

# 2) Expo Go
Write-Host '  [2/2] Iniciando Metro para Expo Go en el puerto 8081 ...' -ForegroundColor Green
Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$carpetaMovil'; npx expo start"

Write-Host ''
Write-Host '  ==============================================' -ForegroundColor Cyan
Write-Host '  En Expo Go escribe esta direccion a mano:' -ForegroundColor White
Write-Host ''
if ($ip) { Write-Host "      exp://$ip`:8081" -ForegroundColor Yellow } else { Write-Host '      exp://TU-IP-DE-RED:8081' -ForegroundColor Yellow }
Write-Host ''
Write-Host '  Celular y computadora en la MISMA red WiFi.' -ForegroundColor DarkGray
Write-Host '  La primera carga tarda 1 a 5 minutos (bundle de 6 MB).' -ForegroundColor DarkGray
Write-Host ''
Write-Host '  API:  http://localhost:5199      Swagger:  /swagger' -ForegroundColor DarkGray
Write-Host '  Parar todo:  .\detener.ps1' -ForegroundColor DarkGray
Write-Host '  Reiniciar:    .\reiniciar.ps1' -ForegroundColor DarkGray
Write-Host '  =============================================='
Write-Host ''
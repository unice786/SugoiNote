# Detiene la API y el servidor de Expo Go.
# Uso:  powershell -ExecutionPolicy Bypass -File .\detener.ps1

$ErrorActionPreference = 'SilentlyContinue'

$puertos = @(5199, 8081, 8082)

foreach ($p in $puertos) {
    $pids = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique

    foreach ($id in $pids) {
        $proceso = Get-Process -Id $id -ErrorAction SilentlyContinue
        if ($proceso) {
            Write-Host "  Puerto $p  ->  $($proceso.ProcessName) (PID $id)" -ForegroundColor Yellow
            Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
        }
    }
}

# Nodos de Metro que se quedaron vivos sin tener el puerto abierto.
Get-Process -Name 'node' -ErrorAction SilentlyContinue |
    Where-Object { (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine -like '*expo*' } |
    ForEach-Object {
        Write-Host "  Metro (node) (PID $($_.Id))" -ForegroundColor Yellow
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }

Start-Sleep -Seconds 2

$libres = $true
foreach ($p in $puertos) {
    if (Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue) { $libres = $false }
}

if ($libres) { Write-Host "`n  Todo detenido. Puertos 5199, 8081 y 8082 libres." -ForegroundColor Green }
else { Write-Host "`n  Queda algun puerto ocupado. Cierra las ventanas a mano si hace falta." -ForegroundColor Red }
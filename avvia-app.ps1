# Aura Syncro - script di avvio (Windows PowerShell)
$Root = $PSScriptRoot

$BackendUrl = 'http://localhost:3001/api/health'
$FrontendUrl = 'http://localhost:5173'

function Wait-ForHttpOk {
    param(
        [string]$Url,
        [string]$Label,
        [int]$MaxAttempts = 30,
        [int]$DelaySeconds = 2
    )

    for ($i = 1; $i -le $MaxAttempts; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                Write-Host "$Label pronto." -ForegroundColor Green
                return $true
            }
        } catch {
            # ancora in avvio
        }

        if ($i -lt $MaxAttempts) {
            Write-Host "  Attendo $Label ($i/$MaxAttempts)..." -ForegroundColor DarkGray
            Start-Sleep -Seconds $DelaySeconds
        }
    }

    Write-Host "ATTENZIONE: $Label non risponde su $Url" -ForegroundColor Red
    Write-Host "Controlla la finestra PowerShell del servizio e gli eventuali errori." -ForegroundColor Yellow
    return $false
}

Write-Host "Avvio Aura Syncro..." -ForegroundColor Cyan

Write-Host "Avvio Backend (porta 3001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Root\backend'; npm run dev" -WindowStyle Normal

$backendReady = Wait-ForHttpOk -Url $BackendUrl -Label "Backend"
if (-not $backendReady) {
    Write-Host "Il frontend partira comunque, ma le API falliranno finche il backend non e attivo." -ForegroundColor Yellow
}

Write-Host "Avvio Frontend (porta 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Root\frontend'; npm run dev" -WindowStyle Normal

$frontendReady = Wait-ForHttpOk -Url $FrontendUrl -Label "Frontend" -MaxAttempts 20

if ($backendReady -and $frontendReady) {
    Write-Host "Apertura browser..." -ForegroundColor Green
    Start-Process $FrontendUrl
    Write-Host "App avviata!" -ForegroundColor Green
} elseif ($frontendReady) {
    Write-Host "Frontend pronto. Apri manualmente: $FrontendUrl" -ForegroundColor Yellow
    Write-Host "Avvia o correggi il backend prima di usare Tavoli e le altre sezioni API." -ForegroundColor Yellow
} else {
    Write-Host "Servizi ancora in avvio. Apri $FrontendUrl quando Vite e pronto." -ForegroundColor Yellow
}

Write-Host "Login: admin@demo.it | Password: admin123" -ForegroundColor Cyan

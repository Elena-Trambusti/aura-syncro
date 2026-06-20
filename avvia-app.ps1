# Aura Syncro - script di avvio (Windows PowerShell)
$Root = $PSScriptRoot

Write-Host "Avvio Aura Syncro..." -ForegroundColor Cyan

Write-Host "Avvio Backend (porta 3001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Root\backend'; npm run dev" -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host "Avvio Frontend (porta 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Root\frontend'; npm run dev" -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host "Apertura browser..." -ForegroundColor Green
Start-Process "http://localhost:5173"

Write-Host "App avviata!" -ForegroundColor Green
Write-Host "Login: admin@demo.it | Password: admin123" -ForegroundColor Cyan

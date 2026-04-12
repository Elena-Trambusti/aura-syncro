# Script di avvio Super App Ristorante
Write-Host "🍽️  Avvio Super App Ristorante..." -ForegroundColor Cyan

# Avvia backend
Write-Host "🚀 Avvio Backend (porta 3001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location 'c:\Users\Elena\Documents\progetto per App Ristorante\backend'; npm run dev" -WindowStyle Normal

Start-Sleep -Seconds 3

# Avvia frontend
Write-Host "🎨 Avvio Frontend (porta 5173)..." -ForegroundColor Yellow  
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location 'c:\Users\Elena\Documents\progetto per App Ristorante\frontend'; npm run dev" -WindowStyle Normal

Start-Sleep -Seconds 3

# Apri browser
Write-Host "🌐 Aprendo il browser..." -ForegroundColor Green
Start-Process "http://localhost:5173"

Write-Host "✅ App avviata!" -ForegroundColor Green
Write-Host "📧 Login: admin@demo.it | Password: admin123" -ForegroundColor Cyan

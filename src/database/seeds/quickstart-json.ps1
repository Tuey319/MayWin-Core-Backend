# Quick Start: Seed 60-Nurse January 2026 Data
# PowerShell script for Windows

Write-Host "🌱 MayWin 60-Nurse Seeder - January 2026" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (-Not (Test-Path ".env")) {
    Write-Host "⚠️  Warning: .env file not found" -ForegroundColor Yellow
    Write-Host "   Please create .env with your database configuration" -ForegroundColor Yellow
    Write-Host ""
}

# Check if JSON file exists
$jsonFile = "test_60nurses_jan2026_business_only_availability.json"
if (-Not (Test-Path $jsonFile)) {
    Write-Host "❌ Error: $jsonFile not found in project root" -ForegroundColor Red
    Write-Host "   Please ensure the JSON file is in the project root directory" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Found: $jsonFile" -ForegroundColor Green
Write-Host ""

# Run database seed
Write-Host "Running JSON-based seeder..." -ForegroundColor Green
Write-Host "──────────────────────────────────────" -ForegroundColor Gray

try {
    npx ts-node src/database/seeds/seed-from-json.ts
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Database seeded successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📊 Data Summary:" -ForegroundColor Cyan
        Write-Host "   • 60 nurses (N001-N060)" -ForegroundColor White
        Write-Host "   • 31 days (January 2026)" -ForegroundColor White
        Write-Host "   • 3 shifts (Morning, Evening, Night)" -ForegroundColor White
        Write-Host "   • ~5,580 availability records" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "❌ Seeding failed with exit code $LASTEXITCODE" -ForegroundColor Red
        Write-Host "   Check your database connection and try again." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "❌ Error running seed: $_" -ForegroundColor Red
    exit 1
}

Write-Host "🚀 Next Steps:" -ForegroundColor Green
Write-Host "──────────────────────────────────────" -ForegroundColor Gray
Write-Host ""

Write-Host "1️⃣  Start the server (in another terminal):" -ForegroundColor Yellow
Write-Host "   npm run dev" -ForegroundColor White
Write-Host ""

Write-Host "2️⃣  Login to get JWT token:" -ForegroundColor Yellow
Write-Host "   POST http://localhost:3000/api/v1/core/auth/login" -ForegroundColor White
Write-Host "   Body: { `"email`": `"admin@demo.com`", `"password`": `"password123`" }" -ForegroundColor White
Write-Host ""

Write-Host "3️⃣  Trigger schedule generation:" -ForegroundColor Yellow
Write-Host "   POST http://localhost:3000/api/v1/core/orchestrator/run" -ForegroundColor White
Write-Host "   Headers: Authorization: Bearer <your-token>" -ForegroundColor White
Write-Host "   Body:" -ForegroundColor White
Write-Host "   {" -ForegroundColor White
Write-Host "     `"scheduleId`": `"1`"," -ForegroundColor White
Write-Host "     `"dto`": {" -ForegroundColor White
Write-Host "       `"startDate`": `"2026-01-01T00:00:00.000Z`"," -ForegroundColor White
Write-Host "       `"endDate`": `"2026-01-31T23:59:59.999Z`"" -ForegroundColor White
Write-Host "     }" -ForegroundColor White
Write-Host "   }" -ForegroundColor White
Write-Host ""

Write-Host "4️⃣  Monitor job progress:" -ForegroundColor Yellow
Write-Host "   GET http://localhost:3000/api/v1/core/jobs/{jobId}" -ForegroundColor White
Write-Host ""

Write-Host "💡 Tip: This is a realistic dataset with 60 nurses!" -ForegroundColor Cyan
Write-Host "   The solver may take 30-60 seconds to complete." -ForegroundColor Cyan
Write-Host ""

Write-Host "🎉 You're all set! Happy scheduling!" -ForegroundColor Green

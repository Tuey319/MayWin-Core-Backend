# Quick Start: Run Database Seed and Test Solver
# PowerShell script for Windows

Write-Host "🌱 MayWin Schedule Generation - Quick Start" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (-Not (Test-Path ".env")) {
    Write-Host "⚠️  Warning: .env file not found" -ForegroundColor Yellow
    Write-Host "   Please create .env with your database configuration" -ForegroundColor Yellow
    Write-Host ""
}

# Step 1: Run database seed
Write-Host "Step 1: Running database seed..." -ForegroundColor Green
Write-Host "──────────────────────────────────────" -ForegroundColor Gray

try {
    npx ts-node src/database/seeds/example-schedule-seed.ts
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Database seeded successfully!" -ForegroundColor Green
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

# Step 2: Instructions for testing
Write-Host "Step 2: Test the solver" -ForegroundColor Green
Write-Host "──────────────────────────────────────" -ForegroundColor Gray
Write-Host ""
Write-Host "Your database is ready! Here's how to test:" -ForegroundColor Cyan
Write-Host ""

Write-Host "1️⃣  Start the server (in another terminal):" -ForegroundColor Yellow
Write-Host "   npm run start:dev" -ForegroundColor White
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
Write-Host "       `"startDate`": `"2026-02-17T00:00:00.000Z`"," -ForegroundColor White
Write-Host "       `"endDate`": `"2026-02-23T23:59:59.999Z`"" -ForegroundColor White
Write-Host "     }" -ForegroundColor White
Write-Host "   }" -ForegroundColor White
Write-Host ""

Write-Host "4️⃣  Check job status:" -ForegroundColor Yellow
Write-Host "   GET http://localhost:3000/api/v1/core/jobs/{jobId}" -ForegroundColor White
Write-Host ""

Write-Host "5️⃣  Preview results:" -ForegroundColor Yellow
Write-Host "   GET http://localhost:3000/api/v1/core/jobs/{jobId}/preview" -ForegroundColor White
Write-Host ""

Write-Host "6️⃣  Apply schedule:" -ForegroundColor Yellow
Write-Host "   POST http://localhost:3000/api/v1/core/jobs/{jobId}/apply" -ForegroundColor White
Write-Host ""

Write-Host "📁 Sample Postman/REST Client file:" -ForegroundColor Cyan
Write-Host "   See: src/database/seeds/README.md" -ForegroundColor White
Write-Host ""

Write-Host "🎉 You're all set! Happy scheduling!" -ForegroundColor Green

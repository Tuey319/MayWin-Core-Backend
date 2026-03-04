# MayWin Core Backend - Postman Collection v4

Comprehensive Postman Collection and Environments for testing the MayWin Core Backend APIs.

## Files

- **MayWin-Core-Backend-v4.postman_collection.json** — Main collection with all endpoints
- **MayWin-Local-Env.postman_environment.json** — Local development environment (localhost:3000)
- **MayWin-Staging-Env.postman_environment.json** — Staging environment
- **MayWin-Production-Env.postman_environment.json** — Production AWS Lambda environment

## Quick Start

1. **Import Collection**
   - Open Postman
   - Click **Import**
   - Select `MayWin-Core-Backend-v4.postman_collection.json`
   - Click **Import**

2. **Import Environment**
   - Click the **Environments** tab
   - Click **Import**
   - Select the appropriate environment file (Local, Staging, or Production)

3. **Login First**
   - Go to **Auth > Login** request
   - Click **Send**
   - This automatically stores the auth token for subsequent requests

4. **Test Endpoints**
   - All endpoints now have the auth token automatically added
   - Hit **Send** on any request to test

## Available Endpoints

### Auth
- `POST /auth/login` — Login and get auth token
- `GET /auth/me` — Get current user info

### Schedule
- `GET /schedule?unitId=2` — Get current schedule
- `GET /schedule-jobs/:jobId` — Get job status

### Workers & Export
- `GET /nurses/export` — Export nurses list
- `GET /units/:unitId/workers` — List workers in unit

### Orchestrator (Solver)
- `POST /orchestrator/run` — Trigger async schedule generation

### Staff Management
- `GET /staff` — List all staff
- `GET /staff/:id` — Get staff by ID
- `POST /staff` — Create new staff member
- `PATCH /staff/:id` — Update staff
- `DELETE /staff/:id` — Delete staff

### Audit Logs
- `GET /audit-logs` — List audit logs
- `GET /audit-logs?export=csv` — Export as CSV
- `POST /audit-logs` — Create audit log entry

## Environment Variables

Each environment includes:
- **baseUrl** — API base URL (auto-switches per environment)
- **authToken** — JWT token (auto-populated after login)
- **userId** — Current user ID
- **userName** — Current user name
- **jobId** — Last created job ID
- **staffId** — Last created staff ID
- **loginEmail** — Test account email
- **loginPassword** — Test account password
- **unitId** — Default unit ID for queries

## Pre-request & Test Scripts

- **Login request** — Auto-stores `authToken`, `userId`, `userName`
- **Run Orchestrator request** — Auto-stores `jobId`
- **Create Staff request** — Auto-stores `staffId`

## Tips

- Always run **Auth > Login** first to populate the token
- Use `{{variableName}}` in requests to reference environment variables
- Click the **eye icon** next to an environment to see variable values
- Tests auto-populate variables for chaining requests

## Notes

- Replace test credentials in environments with your actual values
- For production, ensure you're using the correct Lambda URL
- Keep sensitive credentials (passwords, tokens) secure
- Don't commit environment files with real credentials to version control

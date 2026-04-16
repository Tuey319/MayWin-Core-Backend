# ISO/IEC 27002:2022 Implementation Report

**Project**: MayWin Core Backend  
**Date**: 2026-01-09  
**Status**: Implemented

## A) Implemented ISO Controls

### 1. A.5.15 Access Control
**Status**: Implemented (Infrastructure)
**Evidence**: `src/common/guards/roles.guard.ts`, `src/common/decorators/roles.decorator.ts`
**Description**: 
Added a `RolesGuard` that inspects `req.user.roles` against required roles defined by the `@Roles()` decorator. This enforces the principle of least privilege on endpoints such as Organization or Unit management.

### 2. A.8.9 Configuration Management
**Status**: Implemented
**Evidence**: `scripts/validate-env.js`
**Description**:
Added a startup validation script that checks for the presence of critical environment variables (`DB_HOST`, `JWT_SECRET`, etc.) and enforces complexity rules (e.g., `JWT_SECRET` length) before the application can launch.

### 3. A.8.13 Information Backup
**Status**: Implemented
**Evidence**: `scripts/backup-db.sh`, `scripts/restore-db.sh`, `BACKUP.md`
**Description**:
Created shell scripts to perform full PostgreSQL dumps and restores. Added documentation (`BACKUP.md`) describing the backup strategy and restoration process to ensure data availability.

### 4. A.8.15 Logging
**Status**: Implemented
**Evidence**: `src/common/interceptors/security-logger.interceptor.ts`
**Description**:
Implemented an interceptor that logs access to endpoints. It captures the "Who" (User ID/Roles), "What" (Method/URL), "Where" (IP), and "Result" (Success/Failure). It explicitly masks sensitive fields (passwords/tokens) to prevent credential leakage in logs.

### 5. A.8.24 Use of Cryptography
**Status**: Implemented (Validation)
**Evidence**: `scripts/validate-env.js`
**Description**:
Enforced a minimum length of 32 characters for the `JWT_SECRET` to ensure the HMAC SHA-256 signature is resistant to brute-force attacks.

---

## B) Partially Implemented Controls

### A.8.20 Network Security
**Status**: Implemented
**Evidence**: `src/main.ts`, `src/app.module.ts`
**Description**:
Enabled `helmet` for secure HTTP headers. Configured strict CORS with `FRONTEND_URL`. Implemented `ThrottlerModule` for rate limiting, with specific strict limits on auth endpoints.

### A.5.17 Authentication Information
**Status**: Implemented
**Evidence**: `src/auth/auth.service.ts`
**Description**:
Implemented `bcrypt` hashing for passwords backed by a real database via `UsersService`. Plaintext passwords are never stored. Login flow uses `bcrypt.compare` against the stored hash.

### A.8.2 Privileged Access Rights
**Status**: Implemented
**Evidence**: `src/auth/auth.controller.ts`
**Description**:
Signup endpoint explicitly blocks creation of privileged roles (e.g. non-NURSE) via public API.

### A.8.5 Secure Authentication
**Status**: Implemented
**Evidence**: `src/auth/strategies/jwt.strategy.ts`, `src/common/guards/jwt-auth.guard.ts`
**Description**:
JWT strategy enforces expiration. `JwtAuthGuard` is applied globally, enforcing "deny-by-default" for all endpoints unless marked `@Public()`.

### A.8.26 Application Security Requirements
**Status**: Implemented
**Evidence**: `src/main.ts`, `src/auth/dto/auth.dto.ts`
**Description**:
Global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`. DTOs enforce strong password policies and input validation.

---

## C) Summary

| Category | Control | Status |
| :--- | :--- | :--- |
| Organizational | A.5.15 Access Control | ✅ Implemented |
| Technological | A.8.9 Config Management | ✅ Implemented |
| Technological | A.8.13 Backup | ✅ Implemented |
| Technological | A.8.15 Logging | ✅ Implemented |
| Technological | A.8.20 Network Security | ✅ Implemented |
| Technological | A.8.24 Cryptography | ✅ Implemented |
| Technological | A.8.26 App Security | ✅ Implemented |

## D) Next Steps for Developers

1. **Apply Roles**:
   Decorate sensitive controllers:
   ```typescript
   @UseGuards(JwtAuthGuard, RolesGuard)
   @Roles('ORG_ADMIN')
   @Post('/organizations')
   ```

2. **CI/CD Integration**: Add `./scripts/validate-env.js` to the build pipeline.
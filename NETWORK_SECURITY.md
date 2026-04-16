# Security of Network Services

**Control**: ISO/IEC 27002 A.8.21

This document outlines the network security agreements and configurations for the MayWin Core Backend API.

## 1. API Boundary Protection
- **Transport Security**: All traffic to the API in production must be encrypted using TLS 1.2 or higher. This is enforced at the load balancer or reverse proxy level.
- **Security Headers**: The `helmet` middleware is used to set secure HTTP headers (e.g., `X-Content-Type-Options`, `Strict-Transport-Security`) to protect against common web vulnerabilities like clickjacking and XSS.

## 2. Access Control
- **CORS (Cross-Origin Resource Sharing)**: The API is configured to only accept requests from a specific frontend origin, defined by the `FRONTEND_URL` environment variable. This prevents unauthorized web pages from making requests to the API.
- **Rate Limiting**: The `ThrottlerModule` is used to enforce global rate limits on incoming requests. Stricter limits are applied to sensitive endpoints like `/auth/login` to mitigate brute-force attacks.

## 3. Service Agreement
- The API service is a private, authenticated service. There are no public, un-throttled endpoints other than the health check.
- All business logic is exposed exclusively through the NestJS API. Direct database access from the public internet is strictly forbidden. The database must reside in a private network segment, accessible only by the application server.
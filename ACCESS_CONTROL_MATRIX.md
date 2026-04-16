# Information Access Restriction Matrix

**Control**: ISO/IEC 27002 A.8.3

This matrix maps user roles to key API capabilities, reflecting the implemented access control logic.

| Endpoint / Action | Public (No Auth) | `NURSE` (Authenticated) | `UNIT_MANAGER` | `ORG_ADMIN` | Technical Control |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET /health` | ✅ | ✅ | ✅ | ✅ | `@Public()` |
| `POST /auth/login` | ✅ | ✅ | ✅ | ✅ | `@Public()`, `Throttler` |
| `POST /auth/signup` | ✅ | ✅ | ✅ | ✅ | `@Public()`, DTO validation blocks privileged role assignment. |
| `GET /auth/me` | ❌ | ✅ | ✅ | ✅ | `JwtAuthGuard` |
| `GET /units/:unitId/schedules/current` | ❌ | ✅ (Scoped to user's units) | ✅ | ✅ | `JwtAuthGuard`, Service-level scope check |
| `PATCH /schedule-assignments/:id` | ❌ | ❌ | ✅ | ✅ | `RolesGuard` (`@Roles('UNIT_MANAGER', 'ORG_ADMIN')`) |
| `POST /units` | ❌ | ❌ | ✅ | ✅ | `RolesGuard` (`@Roles('UNIT_MANAGER', 'ORG_ADMIN')`) |
| `POST /organizations` | ❌ | ❌ | ❌ | ✅ | `RolesGuard` (`@Roles('ORG_ADMIN')`) |
| `POST /jobs/:jobId/apply` | ❌ | ❌ | ✅ | ✅ | `RolesGuard` (`@Roles('UNIT_MANAGER', 'ORG_ADMIN')`) |

**Note**:
- **Scoped Access**: Many endpoints available to a `NURSE` are further restricted within the service logic to only allow access to data within their own `organizationId` and `unitIds`, as provided in the JWT.
- **Deny by Default**: Any endpoint not explicitly marked `@Public()` is protected by the global `JwtAuthGuard`.
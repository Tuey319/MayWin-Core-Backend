# RBAC Design for MayWin Core Backend

This document describes the recommended role-based access control model for the MayWin backend and how it should fit the existing JWT, organization, and unit-scoped authorization flow.

## Goals

- Make authorization rules explicit and consistent across the API.
- Separate identity, role membership, and resource ownership.
- Keep tenant isolation as a hard rule even when a role is granted.
- Support the current login experience where the UI shows a role selector, without trusting the selected role as an authorization source.

## Current State

The backend already has most of the building blocks:

- JWT authentication is implemented in `src/core/auth`.
- The JWT payload already carries `roles` and `unitIds`.
- Organization, site, and unit services already perform manual role/org checks.
- A `@Roles(...)` decorator exists in `src/common/decorators/roles.decorator.ts`.
- `src/common/guards/roles.guard.ts` currently returns `true` for every request, so it does not enforce anything yet.

The main gap is that RBAC is not enforced centrally. Today, authorization is split between:

- `JwtAuthGuard` for authentication.
- Service-level checks like `roles.includes('ADMIN')`.
- Per-method org/unit filters in the service layer.

That works, but it is easy to drift over time.

## Canonical Roles

Use these backend role codes as the source of truth:

| Role | Meaning | Typical Access |
|---|---|---|
| `ADMIN` | System-wide administrator | Cross-org access, bootstrap, full admin control |
| `ORG_ADMIN` | Organization administrator | Organization-wide admin within own tenant |
| `UNIT_MANAGER` | Unit-level manager | Unit configuration, scheduling, staff operations |
| `NURSE` | Nursing staff member | Self-service, own availability, own schedule, inbox |

UI label mapping:

| UI Label | Backend Role |
|---|---|
| Admin | `ADMIN` |
| Head Nurse | `UNIT_MANAGER` |
| Nurse | `NURSE` |

If the UI later adds more labels, they should still map to one of the canonical backend role codes.

## Authorization Model

Use a hybrid model:

1. `JwtAuthGuard` verifies identity.
2. `RolesGuard` checks coarse route-level permissions.
3. Service-layer checks enforce tenant and resource ownership.

Why this split matters:

- Roles answer "is this user allowed in this area?"
- Org/unit scoping answers "is this the right tenant or unit?"
- Ownership checks answer "is this the right record?"

Roles alone are not enough for a multi-tenant scheduling system.

## JWT Claims

The JWT should continue to carry:

| Claim | Purpose |
|---|---|
| `sub` | User ID |
| `email` | Login identity |
| `fullName` | Display name |
| `organizationId` | Tenant boundary |
| `roles` | Global and unit-derived roles |
| `unitIds` | Units this user can access |

Relevant files:

- `src/core/auth/types/jwt-payload.ts`
- `src/core/auth/auth.service.ts`
- `src/core/auth/strategies/jwt-strategy.ts`

Important rule: the frontend must never supply roles as authority. The backend should derive roles from the database and issue them in the JWT.

## Role Sources

The current backend already builds roles from two places:

- `user_roles` for global roles.
- `unit_memberships.role_code` for unit-scoped roles.

This is a good model for MayWin because a nurse may belong to a unit with a different access level from the user’s global account.

Recommended rule:

- `user_roles` should drive global permissions like `ADMIN` and `ORG_ADMIN`.
- `unit_memberships.role_code` should drive unit-scoped permissions like `UNIT_MANAGER` and `NURSE`.

## Enforcement Strategy

### Controller Layer

Use `@Roles(...)` on routes that are clearly restricted by role.

Example:

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'ORG_ADMIN')
@Post('/organizations')
createOrganization() {}
```

This is best for coarse policy decisions.

### Service Layer

Keep ownership checks in services for anything scoped by organization, site, or unit.

Examples already present in the codebase:

- `src/core/organizations/organizations.service.ts`
- `src/core/sites/sites.service.ts`
- `src/core/units/units.service.ts`

This is where you keep rules like:

- same organization only
- same unit only
- admin bypass
- resource existence checks

### Do Not Rely on Frontend UI Alone

The login page currently shows role options such as Admin, Nurse, and Head Nurse. That is useful for UX, but it must be treated as a navigation hint only.

The backend must decide the actual role membership.

## Suggested Route Policy

This is the recommended first-pass access matrix for the backend.

| Area | ADMIN | ORG_ADMIN | UNIT_MANAGER | NURSE |
|---|---|---|---|---|
| `/auth/login`, `/auth/verify-otp`, `/auth/me` | Yes | Yes | Yes | Yes |
| `/roles` | Yes | Yes | Yes | Yes |
| Organizations CRUD | Yes | Same org only | No | No |
| Sites CRUD | Yes | Same org only | No | No |
| Units CRUD | Yes | Same org only | Same org/unit only | No |
| Unit memberships | Yes | Same org only | Same unit only | No |
| Unit configuration | Yes | Same org only | Same unit only | Read-only at most |
| Staff management | Yes | Same org only | Limited, if needed | No |
| Schedules and jobs | Yes | Same org only | Same unit only | Own-view only |
| Availability / preferences | Yes | Same org only | Same unit only | Own records |
| Worker messages | Yes | Same org only | Manager inbox | Own inbox |
| Audit logs | Yes | Same org only | Optional read-only | No |

If you want to keep the first release smaller, the safest default is:

- `ADMIN` and `ORG_ADMIN` for all admin surfaces.
- `UNIT_MANAGER` for unit configuration and scheduling.
- `NURSE` for self-service only.

## Proposed File Changes

These are the main backend files that should eventually participate in RBAC:

- `src/common/guards/roles.guard.ts`
- `src/common/decorators/roles.decorator.ts`
- `src/core/auth/auth.service.ts`
- `src/core/auth/auth.controller.ts`
- `src/core/organizations/*`
- `src/core/sites/*`
- `src/core/units/*`
- `src/core/unit-config/*`
- `src/core/staff/*`
- `src/core/scheduling/*`
- `src/core/jobs/*`
- `src/core/messages/*`
- `src/core/audit-logs/*`

## Implementation Plan

### Phase 1: Make Roles Enforceable

- Implement `RolesGuard` so it reads route metadata from `@Roles(...)`.
- Apply `RolesGuard` together with `JwtAuthGuard` on restricted controllers.
- Keep the existing service-layer organization checks.

### Phase 2: Standardize Policies

- Decide which controllers are `ADMIN` only.
- Decide which controllers are `ORG_ADMIN` or `UNIT_MANAGER` allowed.
- Add `@Roles(...)` annotations to the obvious admin routes.

### Phase 3: Tighten Resource Ownership

- Keep org checks in services.
- Keep unit checks in services.
- Make sure list endpoints always filter by tenant unless the caller is truly global admin.

### Phase 4: Update Frontend Behavior

- Use the role selector on the login screen only for UI intent, not permission.
- After login, render menus based on the JWT `roles` claim.
- Hide unavailable features, but still rely on the backend for enforcement.

## Testing Strategy

Add tests for:

- `RolesGuard` metadata enforcement.
- Admin-only routes returning `403` for unauthorized roles.
- Org mismatch rejection for non-admin users.
- Unit mismatch rejection for unit-scoped routes.
- JWT payload role generation from `user_roles` and `unit_memberships`.

Recommended test files:

- `test/core-auth.spec.ts`
- `test/core-organizations.spec.ts`
- `test/core-sites.spec.ts`
- `test/core-units.spec.ts`

## Security Rules

- Never trust the role selected on the login page.
- Never use frontend route hiding as the only protection.
- Never return cross-tenant data unless the caller is `ADMIN`.
- Do not use `unitIds` alone as authorization for mutations unless the service explicitly allows it.
- Prefer deny-by-default behavior for new endpoints.

## Practical Recommendation

For this codebase, the best balance is:

- `JwtAuthGuard` for authentication.
- `RolesGuard` for explicit role gates.
- service-layer ownership checks for tenant safety.

That gives you a secure model without forcing a full rewrite of the current auth flow.


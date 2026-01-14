// src/core/auth/types/jwt-payload.ts
export interface JwtPayload {
  sub: number; // user id
  organizationId: number;
  roles: string[];
  unitIds: number[];
}

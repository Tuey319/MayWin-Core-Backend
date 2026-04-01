// src/core/auth/types/jwt-payload.ts
export interface JwtPayload {
  sub: number;               // user id
  email: string;
  fullName: string;
  organizationId: number;
  roles: string[];
  unitIds: number[];
}

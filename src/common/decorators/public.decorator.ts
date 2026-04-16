// src/common/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';

/**
 * Mark a route as public (no JWT required).
 * ISO 27001:2022 — 5.15 (Access control): explicit allowlist of public routes.
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

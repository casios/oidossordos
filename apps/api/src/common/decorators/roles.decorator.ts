// apps/api/src/common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export type Role = 'usuario' | 'moderador' | 'administrador';

export const ROLES_KEY = 'roles';

/**
 * Uso: @Roles('moderador', 'administrador') sobre un método de controller.
 * Ver la matriz de autorización completa en `docs/Diseño API.md` sección 2.3.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

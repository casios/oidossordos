// apps/api/src/common/guards/roles.guard.spec.ts
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role } from '../decorators/roles.decorator';

function contextoCon(user: { role: Role } | undefined) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as any;
}

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
  const guard = new RolesGuard(reflector);

  beforeEach(() => jest.resetAllMocks());

  it('deja pasar cuando la ruta no declara @Roles (ruta pública o solo autenticada)', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    expect(guard.canActivate(contextoCon(undefined))).toBe(true);
  });

  it('deja pasar cuando el rol del usuario está entre los requeridos', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['moderador', 'administrador']);
    expect(guard.canActivate(contextoCon({ role: 'administrador' }))).toBe(true);
  });

  it('bloquea a un usuario común en una ruta de moderación (matriz de docs/Diseño API.md 2.3)', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['moderador', 'administrador']);
    expect(() => guard.canActivate(contextoCon({ role: 'usuario' }))).toThrow(ForbiddenException);
  });

  it('bloquea si no hay usuario en la petición', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['moderador']);
    expect(() => guard.canActivate(contextoCon(undefined))).toThrow(ForbiddenException);
  });
});

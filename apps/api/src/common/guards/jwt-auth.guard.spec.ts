// apps/api/src/common/guards/jwt-auth.guard.spec.ts
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

function contextoCon(headers: Record<string, string>) {
  const req: any = { headers };
  return {
    req,
    ctx: {
      switchToHttp: () => ({ getRequest: () => req }),
    } as any,
  };
}

describe('JwtAuthGuard', () => {
  const jwt = { verify: jest.fn() } as unknown as JwtService;
  const guard = new JwtAuthGuard(jwt);

  beforeEach(() => jest.resetAllMocks());

  it('deja pasar y expone { sub, role } en req.user con un token válido', () => {
    const payload = { sub: 'user-uuid', role: 'moderador' };
    (jwt.verify as jest.Mock).mockReturnValue(payload);

    const { req, ctx } = contextoCon({ authorization: 'Bearer un.token.valido' });

    expect(guard.canActivate(ctx)).toBe(true);
    expect(jwt.verify).toHaveBeenCalledWith('un.token.valido');
    // RolesGuard y OwnershipGuard leen de aquí; si se rompe el contrato del
    // payload, la autorización entera deja de funcionar.
    expect(req.user).toEqual(payload);
  });

  it('rechaza si no hay header Authorization', () => {
    const { ctx } = contextoCon({});
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('rechaza un esquema distinto de Bearer', () => {
    const { ctx } = contextoCon({ authorization: 'Basic dXNlcjpwYXNz' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    expect(jwt.verify).not.toHaveBeenCalled();
  });

  it('traduce un token inválido o expirado a 401, no a 500', () => {
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error('jwt expired');
    });
    const { ctx } = contextoCon({ authorization: 'Bearer expirado' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});

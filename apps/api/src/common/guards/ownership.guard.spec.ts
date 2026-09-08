// apps/api/src/common/guards/ownership.guard.spec.ts
import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { OwnershipGuard } from './ownership.guard';

const CREADOR = 'user-creador-uuid';
const OTRO = 'user-ajeno-uuid';

function contextoCon(user: { sub: string; role: string }) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user, params: { id: 'evento-uuid' } }) }),
  } as any;
}

describe('OwnershipGuard', () => {
  const findUnique = jest.fn();
  const prisma = { event: { findUnique } } as unknown as PrismaService;
  const guard = new OwnershipGuard(prisma, 'event');

  beforeEach(() => jest.resetAllMocks());

  it('deja pasar a un moderador sin consultar la base', async () => {
    await expect(guard.canActivate(contextoCon({ sub: OTRO, role: 'moderador' }))).resolves.toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('deja al creador editar su propio contenido mientras siga pendiente', async () => {
    findUnique.mockResolvedValue({ createdBy: CREADOR, status: 'pendiente' });
    await expect(guard.canActivate(contextoCon({ sub: CREADOR, role: 'usuario' }))).resolves.toBe(true);
  });

  it('impide al creador editar su contenido una vez aprobado', async () => {
    // La regla que más fácil se "simplifica" por error: una vez publicado,
    // ni el autor original puede editarlo, solo Moderador+.
    findUnique.mockResolvedValue({ createdBy: CREADOR, status: 'aprobado' });
    await expect(guard.canActivate(contextoCon({ sub: CREADOR, role: 'usuario' }))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('impide editar contenido pendiente de otro usuario', async () => {
    findUnique.mockResolvedValue({ createdBy: CREADOR, status: 'pendiente' });
    await expect(guard.canActivate(contextoCon({ sub: OTRO, role: 'usuario' }))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rechaza si el recurso no existe', async () => {
    findUnique.mockResolvedValue(null);
    await expect(guard.canActivate(contextoCon({ sub: CREADOR, role: 'usuario' }))).rejects.toThrow(
      ForbiddenException,
    );
  });
});

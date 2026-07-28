// apps/api/src/common/guards/ownership.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

type Entity = 'band' | 'venue' | 'event';

/**
 * Permite la acción si:
 *  - el usuario es Moderador/Administrador, o
 *  - el usuario es el creador del recurso Y el recurso sigue `pendiente`
 *    (ver diseno-api.md, matriz de autorización: "editar su propio
 *    contenido pendiente" vs. "editar contenido de otros").
 * Una vez aprobado, solo Moderador+ puede editar, incluso el creador original.
 */
@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entity: Entity,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const { user, params } = req;

    if (user.role === 'moderador' || user.role === 'administrador') {
      return true;
    }

    const resource = await (this.prisma[this.entity] as any).findUnique({
      where: { id: params.id },
      select: { createdBy: true, status: true },
    });

    if (!resource) {
      throw new ForbiddenException('Recurso no encontrado');
    }

    if (resource.createdBy !== user.sub) {
      throw new ForbiddenException('No puedes editar contenido de otro usuario');
    }

    if (resource.status !== 'pendiente') {
      throw new ForbiddenException(
        'Este contenido ya fue publicado; solo un Moderador puede editarlo',
      );
    }

    return true;
  }
}

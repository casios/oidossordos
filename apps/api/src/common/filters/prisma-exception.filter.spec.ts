// apps/api/src/common/filters/prisma-exception.filter.spec.ts
import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter } from './prisma-exception.filter';

function hostFalso() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = { switchToHttp: () => ({ getResponse: () => ({ status }) }) } as any;
  return { host, status, json };
}

function errorPrisma(code: string, mensaje: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError(mensaje, {
    code,
    clientVersion: '5.10.0',
    meta,
  });
}

describe('PrismaExceptionFilter', () => {
  const filter = new PrismaExceptionFilter();

  it('traduce el choque de horario a 409 SCHEDULE_CONFLICT', () => {
    // El constraint EXCLUDE de Postgres es la única fuente de esta regla; si
    // este mapeo se rompe, el usuario recibe un 500 opaco al armar un cartel.
    const { host, status, json } = hostFalso();
    filter.catch(
      errorPrisma('P2010', 'db error: conflicting key value violates exclusion constraint "excl_stage_time_overlap"'),
      host,
    );

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'SCHEDULE_CONFLICT', message: expect.any(String) },
    });
  });

  it('traduce una violación de unicidad a 409 UNIQUE_VIOLATION nombrando el campo', () => {
    const { host, status, json } = hostFalso();
    filter.catch(errorPrisma('P2002', 'Unique constraint failed', { target: ['email'] }), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'UNIQUE_VIOLATION', message: expect.stringContaining('email') },
    });
  });

  it('traduce una llave foránea inválida a 400 FOREIGN_KEY_VIOLATION', () => {
    const { host, status, json } = hostFalso();
    filter.catch(errorPrisma('P2003', 'Foreign key constraint failed'), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'FOREIGN_KEY_VIOLATION', message: expect.any(String) },
    });
  });

  it('no filtra detalles internos en un error desconocido', () => {
    const { host, status, json } = hostFalso();
    filter.catch(errorPrisma('P2025', 'Query interpretation error: tabla secreta'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado' },
    });
  });
});

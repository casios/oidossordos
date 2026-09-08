// apps/api/src/common/filters/prisma-exception.filter.ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

/**
 * Traduce errores de Postgres/Prisma al formato de error estándar de la API
 * (ver `docs/Diseño API.md` sección 1.3). El caso más importante: el constraint
 * EXCLUDE de choque de horario (código 23P01, exclusion_violation) se mapea
 * directo a 409 SCHEDULE_CONFLICT en vez de dejar pasar un 500 genérico.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // P2010: raw query failed — Prisma envuelve así los errores de constraint
    // que no reconoce nativamente (como EXCLUDE). Se inspecciona el mensaje
    // subyacente de Postgres para distinguir el caso de choque de horario.
    const pgError = (exception.meta?.['message'] as string) ?? exception.message;

    if (pgError.includes('excl_stage_time_overlap')) {
      return response.status(HttpStatus.CONFLICT).json({
        error: {
          code: 'SCHEDULE_CONFLICT',
          message:
            'Ya existe una banda programada en este escenario en ese horario',
        },
      });
    }

    // P2002: unique constraint violation (ej. slug duplicado, email duplicado)
    if (exception.code === 'P2002') {
      const target = (exception.meta?.['target'] as string[])?.join(', ');
      return response.status(HttpStatus.CONFLICT).json({
        error: {
          code: 'UNIQUE_VIOLATION',
          message: `Ya existe un registro con ese valor (${target})`,
        },
      });
    }

    // P2003: foreign key violation
    if (exception.code === 'P2003') {
      return response.status(HttpStatus.BAD_REQUEST).json({
        error: {
          code: 'FOREIGN_KEY_VIOLATION',
          message: 'Referencia inválida a un recurso relacionado',
        },
      });
    }

    // Cualquier otro error de Prisma: 500 genérico, sin filtrar detalles internos
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Ocurrió un error inesperado',
      },
    });
  }
}

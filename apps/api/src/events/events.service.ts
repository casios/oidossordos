// apps/api/src/events/events.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateEventDto, CreateLineupEntryDto, ListEventsQueryDto } from './dto/events.dto';
import slugify from 'slugify';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListEventsQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    // deleted_at IS NULL siempre — es el filtro por defecto que toda
    // consulta pública debe aplicar (ver diseno-base-de-datos.md decisión 12).
    const where: any = {
      deletedAt: null,
      status: 'aprobado',
    };

    if (query.city) {
      where.venue = { city: { contains: query.city, mode: 'insensitive' } };
    }
    if (query.from || query.to) {
      where.startDate = {};
      if (query.from) where.startDate.gte = new Date(query.from);
      if (query.to) where.startDate.lte = new Date(query.to);
    }
    if (query.q) {
      where.name = { contains: query.q, mode: 'insensitive' };
    }
    if (query.isTribute === 'true') {
      where.eventBands = { some: { band: { isTribute: true } } };
    } else if (query.isTribute !== 'all') {
      // Por defecto se excluyen tributos de los resultados públicos
      where.eventBands = { none: { band: { isTribute: true } } };
    }

    const [data, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { startDate: 'asc' },
        include: { venue: true },
      }),
      this.prisma.event.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findByIdOrSlug(idOrSlug: string) {
    const event = await this.prisma.event.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        deletedAt: null,
      },
      include: {
        venue: true,
        ticketInfo: true,
        eventStages: { include: { stage: true }, orderBy: { sortOrder: 'asc' } },
        eventBands: {
          include: { band: true, eventStage: true },
          orderBy: { startTime: 'asc' },
        },
      },
    });

    if (!event) throw new NotFoundException('Evento no encontrado');
    return event;
  }

  async create(dto: CreateEventDto, userId: string) {
    const slug = await this.uniqueSlug(dto.name);

    return this.prisma.event.create({
      data: {
        name: dto.name,
        slug,
        type: dto.type,
        description: dto.description,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        venueId: dto.venueId,
        sourceType: 'manual',
        status: 'pendiente', // Siempre, ver RF-19
        createdBy: userId,
      },
    });
  }

  async addToLineup(eventId: string, dto: CreateLineupEntryDto) {
    // Si esto viola el constraint EXCLUDE (choque de horario), Prisma lanza
    // PrismaClientKnownRequestError y el PrismaExceptionFilter global lo
    // traduce a 409 SCHEDULE_CONFLICT — no hay try/catch aquí a propósito,
    // el filtro es la única fuente de este mapeo (ver prisma-exception.filter.ts).
    return this.prisma.eventBand.create({
      data: {
        eventId,
        bandId: dto.bandId,
        eventStageId: dto.eventStageId,
        startTime: dto.startTime ? new Date(dto.startTime) : null,
        endTime: dto.endTime ? new Date(dto.endTime) : null,
        billingOrder: dto.billingOrder,
      },
    });
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name, { lower: true, strict: true });
    let candidate = base;
    let n = 1;

    // Respeta el índice único parcial (solo entre registros activos) —
    // ver diseno-base-de-datos.md decisión 12.
    while (
      await this.prisma.event.findFirst({
        where: { slug: candidate, deletedAt: null },
      })
    ) {
      candidate = `${base}-${++n}`;
    }

    return candidate;
  }
}

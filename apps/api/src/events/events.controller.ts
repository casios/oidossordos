// apps/api/src/events/events.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { EventsService } from './events.service';
import { CreateEventDto, CreateLineupEntryDto, ListEventsQueryDto } from './dto/events.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // Pública: solo status=aprobado si no hay sesión (ver diseno-api.md 3.5)
  @Get()
  async list(@Query() query: ListEventsQueryDto) {
    return this.eventsService.list(query);
  }

  @Get(':idOrSlug')
  async detail(@Param('idOrSlug') idOrSlug: string) {
    return this.eventsService.findByIdOrSlug(idOrSlug);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Body() dto: CreateEventDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    // Nace en status=pendiente siempre, sin importar el rol de quien crea
    // (incluso un Administrador pasa por moderación — simplicidad de reglas
    // sobre optimización de conveniencia, ver RF-19).
    return this.eventsService.create(dto, user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('moderador', 'administrador')
  @Post(':id/lineup')
  async addToLineup(
    @Param('id') eventId: string,
    @Body() dto: CreateLineupEntryDto,
  ) {
    // El choque de horario (409 SCHEDULE_CONFLICT) lo garantiza el
    // constraint EXCLUDE de Postgres, no una validación manual aquí —
    // ver prisma/manual-constraints.sql y PrismaExceptionFilter.
    return this.eventsService.addToLineup(eventId, dto);
  }
}

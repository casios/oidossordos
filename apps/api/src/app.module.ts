// apps/api/src/app.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { EventsController } from './events/events.controller';
import { EventsService } from './events/events.service';
// Módulos pendientes de scaffolding con el mismo patrón:
// bands, venues, moderation, users, reminders (ver diseño respectivo en /docs)

@Module({
  imports: [
    JwtModule.register({
      // En producción debería ser un par de llaves RS256 en vez de un secreto
      // simétrico, pero esa decisión no está escrita en ningún documento:
      // `docs/Diseño API.md` sección 2.1 solo define el payload y los TTL.
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController, EventsController],
  providers: [PrismaService, AuthService, EventsService],
})
export class AppModule {}

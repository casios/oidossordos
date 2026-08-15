// apps/api/src/main.ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true, // necesario para la cookie httpOnly del refresh token
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();

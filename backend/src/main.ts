import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import * as fs from 'node:fs';
import { ValidationPipe, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from './app.module';
import { uploadsGuard } from './common/uploads-guard';
import { TOTAL_COUNT_HEADER } from './common/pagination';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api/v1');
  // Derrière nginx (VPS) : IP réelle du client pour le journal d'audit.
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');

  // Fichiers uploadés : servis statiquement derrière contrôle de session / tenant.
  const uploadsDir = join(process.cwd(), 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });
  // Double montage : le proxy du VPS ne route que /api/* vers le backend.
  const guard = uploadsGuard(app.get(JwtService));
  for (const prefix of ['/uploads', '/api/uploads']) {
    app.use(prefix, guard);
    app.useStaticAssets(uploadsDir, { prefix: prefix + '/' });
  }
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: corsOrigins, credentials: true, exposedHeaders: [TOTAL_COUNT_HEADER] });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  logger.log(`VECTRACOM API démarrée sur http://localhost:${port}/api/v1`);
}

bootstrap();

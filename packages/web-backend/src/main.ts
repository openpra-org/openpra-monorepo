import { NestFactory } from '@nestjs/core';
import { ApiModule } from './api.module';

async function bootstrap() {
  const app = await NestFactory.create(ApiModule);
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Accept', 'Accept-Encoding', 'Authorization', 'Content-Type', 'DNT', 'Origin', 'User-Agent', 'X-CSRFToken', 'X-Requested-With'],
    maxAge: 86400,
    preflightContinue: true,
    optionsSuccessStatus: 200
  });
  await app.listen(8000);
}

bootstrap();
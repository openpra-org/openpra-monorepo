import { NestFactory } from '@nestjs/core';
import { SentryInterceptor } from '@ntegral/nestjs-sentry';
import { CorsConfig } from './cors';
import { ApiModule } from './api.module';

async function bootstrap() {
  const app = await NestFactory.create(ApiModule);
  app.enableCors(CorsConfig);
  app.useGlobalInterceptors(new SentryInterceptor());
  await app.listen(8000);
}

bootstrap();

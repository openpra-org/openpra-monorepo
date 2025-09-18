import { NestFactory } from "@nestjs/core";
import { CorsConfig } from "./cors";
import { json, urlencoded, raw } from "express";
import { ApiModule } from "./api.module";

async function bootstrap() {
  const app = await NestFactory.create(ApiModule);
  app.enableCors(CorsConfig);
  app.use('/api/quantify/scram-node', raw({ type: 'application/octet-stream', limit: '50mb' }));
  app.use(json({ limit: "50mb" }));
  app.use(urlencoded({ extended: true, limit: "50mb" }));
  await app.listen(8000);
}

bootstrap();
import { NestFactory } from "@nestjs/core";
import { CorsConfig } from "./cors";
import { json, urlencoded } from "express";
import { ApiModule } from "./api.module";

async function bootstrap() {
  const app = await NestFactory.create(ApiModule);
  app.enableCors(CorsConfig);
  app.use(json({ limit: "50mb" }));
  app.use(urlencoded({ extended: true, limit: "50mb" }));
  await app.listen(8000);
}

bootstrap();

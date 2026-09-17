import "reflect-metadata";
import { jsonResponses } from "interfaces-shared-types/json";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(jsonResponses);
  app.useBodyParser("json", { limit: process.env["HTTP_JSON_LIMIT"] ?? "256mb" });
  app.useBodyParser("urlencoded", { limit: process.env["HTTP_JSON_LIMIT"] ?? "256mb", extended: true });
  app.setGlobalPrefix("api");
  app.enableCors({
    origin: process.env["APP_BASE_URL"] ?? "http://localhost:4201",
    credentials: true,
  });
  const port = Number(process.env["PORT"] ?? 8000);
  await app.listen(port);
  console.log(`web-backend listening on http://localhost:${String(port)}`);
}

void bootstrap();

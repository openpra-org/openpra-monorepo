import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useBodyParser("json", { limit: "25mb" });
  app.useBodyParser("urlencoded", { limit: "25mb", extended: true });
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

import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { CorsConfig } from "./cors";
import { ApiModule } from "./api.module";

/**
 * Bootstraps the NestJS HTTP application for the OpenPRA web-backend.
 *
 * Creates the root application with `ApiModule`, enables CORS using the
 * shared `CorsConfig`, and starts listening on port 8000.
 */
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(ApiModule);
  app.enableCors(CorsConfig);
  app.useBodyParser("json", { limit: "50mb" });
  app.useBodyParser("urlencoded", { limit: "50mb", extended: true });
  await app.listen(8000);
}

void bootstrap();

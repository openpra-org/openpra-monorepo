import { NestFactory } from "@nestjs/core";
import { CorsConfig } from "./cors";
import { ApiModule } from "./api.module";

/**
 * Bootstraps the NestJS HTTP application for the OpenPRA web-backend.
 *
 * Creates the root application with `ApiModule`, enables CORS using the
 * shared `CorsConfig`, and starts listening on port 8000.
 */
async function bootstrap() {
  const app = await NestFactory.create(ApiModule);
  app.enableCors(CorsConfig);
  await app.listen(8000);
}

void bootstrap();

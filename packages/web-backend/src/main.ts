import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { CorsConfig } from "./cors";
import { ApiModule } from "./api.module";
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(ApiModule);
  app.enableCors(CorsConfig);
  app.useBodyParser("json", { limit: "50mb" });
  app.useBodyParser("urlencoded", { limit: "50mb", extended: true });
  await app.listen(8000);
}
void bootstrap();

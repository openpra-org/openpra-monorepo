import { NestFactory } from "@nestjs/core";
import { CorsConfig } from "./cors";
import { ApiModule } from "./api.module";
import { LoggerFactory } from "./factory/logger.factory";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(ApiModule, {
    logger: LoggerFactory("web-backend"),
  });
  app.enableCors(CorsConfig);
  await app.listen(8000);
}

void bootstrap();

import { NestFactory } from "@nestjs/core";
import { CorsConfig } from "./cors";
import { ApiModule } from "./api.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(ApiModule);
  app.enableCors(CorsConfig);
  await app.listen(8000);
}

void bootstrap();

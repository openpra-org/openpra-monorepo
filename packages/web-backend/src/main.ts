import { NestFactory } from "@nestjs/core";
import { HttpExceptionFilter } from "shared-types/src/lib/errors/http-exception.filter";
import { CorsConfig } from "./cors";
import { ApiModule } from "./api.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(ApiModule);
  app.enableCors(CorsConfig);
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(8000);
}

void bootstrap();

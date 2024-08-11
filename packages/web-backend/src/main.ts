import { NestFactory } from "@nestjs/core";
import { CorsConfig } from "./cors";
import { ApiModule } from "./api.module";
import { HttpExceptionFilter } from "./filters/http-exception.filter";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(ApiModule);
  app.enableCors(CorsConfig);
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(8000);
}

void bootstrap();

import { NestFactory } from "@nestjs/core";
import { JobBrokerModule } from "./job-broker.module";
import { HttpExceptionFilter } from "./exception-filters/http-exception.filter";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(JobBrokerModule);
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(3000);
}

void bootstrap();

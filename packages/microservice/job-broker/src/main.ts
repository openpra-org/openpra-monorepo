import { NestFactory } from "@nestjs/core";
import { JobBrokerModule } from "./job-broker.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(JobBrokerModule);
  await app.listen(3000);
}

void bootstrap();

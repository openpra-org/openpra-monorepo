import { NestFactory } from "@nestjs/core";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { EnvVarKeys } from "../config/env_vars.config";
import { getRabbitMQConfig } from "../config/rabbitmq.config";
import { QuantificationConsumerModule } from "./quantification/quantification-consumer.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(QuantificationConsumerModule, {
    transport: Transport.RMQ,
    options: {
      urls: [getRabbitMQConfig()[EnvVarKeys.RABBITMQ_URL]],
    },
  });
  await app.listen();
}

void bootstrap();

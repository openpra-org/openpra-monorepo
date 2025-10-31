import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { Transport } from "@nestjs/microservices";
import { EnvVarKeys } from "../config/env_vars.config";
import { QuantificationConsumerModule } from "./quantification/quantification-consumer.module";

/**
 * Bootstrap function for the RabbitMQ microservice consumer.
 *
 * @remarks
 * Creates the Nest application, configures an RMQ microservice transport using
 * `ENV_RABBITMQ_URL`, and starts listening for messages.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(QuantificationConsumerModule);
  const configService: ConfigService = app.get(ConfigService);
  const url = configService.getOrThrow<string>(EnvVarKeys.ENV_RABBITMQ_URL);
  const connected = app.connectMicroservice({
    transport: Transport.RMQ,
    options: {
      urls: [url],
    },
  });
  await connected.listen();
}

void bootstrap();

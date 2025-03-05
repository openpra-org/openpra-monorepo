import { NestFactory } from "@nestjs/core";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { ConfigService } from "@nestjs/config";
import { EnvVarKeys } from "../config/env_vars.config";
import { QuantificationConsumerModule } from "./quantification/quantification-consumer.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(QuantificationConsumerModule);
  const configService: ConfigService = app.get(ConfigService);
  const url = configService.getOrThrow<string>(EnvVarKeys.ENV_RABBITMQ_URL);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [url],
    },
  });
  await app.startAllMicroservices();
  // The port number provided in the app.listen() method does not have to be exposed in Docker.
  // This is a placebo port number. We do not have to actually listen to the port, but we need the app.listen() method
  // to properly launch the app. And the app.listen() method requires a port number.
  await app.listen(5555);
}

void bootstrap();

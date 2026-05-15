import { NestFactory } from "@nestjs/core";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import { EnvVarKeys } from "../config/env_vars.config";
import { RaptorEngineModule } from "./raptor-engine.module";
async function bootstrap(): Promise<void> {
  const logger = new Logger();
  logger.debug("Initializing the app...");
  const app = await NestFactory.create(RaptorEngineModule);
  logger.debug("Configuring consumer microservice...");
  const configService: ConfigService = app.get(ConfigService);
  const url = configService.getOrThrow<string>(EnvVarKeys.ENV_RABBITMQ_URL);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [url],
    },
  });
  logger.debug("Starting consumer microservice...");
  await app.startAllMicroservices();
  await app.listen(5555);
}
void bootstrap();

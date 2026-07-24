import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { EnvVarKeys } from '../config/env_vars.config';
import { PraetorRunnerModule } from './praetor-runner.module';
async function bootstrap(): Promise<void> {
    const logger = new Logger();
    logger.debug('Initializing the solver runner...');
    const app = await NestFactory.create(PraetorRunnerModule);
    logger.debug('Configuring solver runner microservice...');
    const configService: ConfigService = app.get(ConfigService);
    const url = configService.getOrThrow<string>(EnvVarKeys.ENV_RABBITMQ_URL);
    app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.RMQ,
        options: {
            urls: [url],
        },
    });
    logger.debug('Starting solver runner microservice...');
    await app.startAllMicroservices();
    await app.listen(5556);
}
void bootstrap();

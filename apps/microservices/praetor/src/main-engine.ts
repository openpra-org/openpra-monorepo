import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { EnvVarKeys } from '../config/env_vars.config';
import { PraetorEngineModule } from './praetor-engine.module';
async function bootstrap(): Promise<void> {
    const logger = new Logger();
    logger.debug('Initializing the app...');
    const app = await NestFactory.create(PraetorEngineModule);
    logger.debug('Configuring consumer microservice...');
    const configService: ConfigService = app.get(ConfigService);
    const url = configService.getOrThrow<string>(EnvVarKeys.ENV_RABBITMQ_URL);
    app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.RMQ,
        options: {
            urls: [url],
        },
    });
    logger.debug('Starting consumer microservice...');
    await app.startAllMicroservices();
    const port = Number(process.env['PRAETOR_ENGINE_PORT'] ?? 5555);
    await app.listen(Number.isSafeInteger(port) && port >= 0 ? port : 5555);
}
void bootstrap();

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication, Logger } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { HttpExceptionFilter } from './http-exception.filter';
import { PraetorManagerModule } from './praetor-manager.module';
const logger = new Logger('ProcessErrorHandler');
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception detected:', error);
    logger.error('Stack trace:', error.stack);
});
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection detected at:', promise);
    logger.error('Rejection reason:', String(reason));
});
async function bootstrap(): Promise<void> {
    const bootstrapLogger = new Logger();
    bootstrapLogger.debug('Initializing the app...');
    const app: INestApplication = await NestFactory.create(PraetorManagerModule);
    bootstrapLogger.debug('Attaching the exception filter...');
    app.useGlobalFilters(new HttpExceptionFilter());
    const hostUrl = process.env['HOST_URL'] ?? 'http://localhost:3000';
    const isProduction = process.env['NODE_ENV'] === 'production';
    const swaggerConfig = new DocumentBuilder()
        .setTitle('OpenPRA Distributed Multi-Queue API')
        .setDescription('PRA quantification and task execution message-broker')
        .setVersion('0.0.1')
        .setLicense('MIT', 'https://opensource.org/license/mit/')
        .addServer(isProduction ? hostUrl : 'http://localhost:3000')
        .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    bootstrapLogger.debug('Creating the API Documentation...');
    SwaggerModule.setup('/q/docs', app, document, {
        customSiteTitle: 'OpenPRA-MQ API Docs',
        explorer: true,
        swaggerOptions: {
            persistAuthorization: true,
            displayRequestDuration: true,
            filter: true,
            tagsSorter: 'alpha',
            operationsSorter: 'alpha',
        },
    });
    app.use(json({ limit: '50mb' }));
    app.use(urlencoded({ extended: true, limit: '50mb' }));
    bootstrapLogger.debug('Microservices have been initialized.');
    await app.listen(3000);
}
void bootstrap();

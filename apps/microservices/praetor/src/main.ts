import { NestFactory } from '@nestjs/core';
import { NestiaSwaggerComposer } from '@nestia/sdk';
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { INestApplication, Logger } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { HttpExceptionFilter } from './http-exception.filter';
import { PraetorManagerModule } from './praetor-manager.module';
const logger = new Logger('ProcessErrorHandler');
process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception detected:', error);
    logger.error('Stack trace:', error.stack);
});
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Rejection detected at:', promise);
    logger.error('Rejection reason:', reason);
});
async function bootstrap(): Promise<void> {
    const logger = new Logger();
    logger.debug('Initializing the app...');
    const app: INestApplication = await NestFactory.create(PraetorManagerModule);
    logger.debug('Attaching the exception filter...');
    app.useGlobalFilters(new HttpExceptionFilter());
    const document: OpenAPIObject = (await NestiaSwaggerComposer.document(app, {
        openapi: '3.0',
        info: {
            title: 'OpenPRA Distributed Multi-Queue API',
            description: 'PRA quantification and task execution message-broker',
            version: '0.0.1',
            license: {
                name: 'MIT',
                identifier: 'MIT',
            },
        },
        servers: [],
        beautify: true,
        decompose: true,
        additional: true,
    })) as OpenAPIObject;
    logger.debug('Creating the API Documentation...');
    SwaggerModule.setup('/q/docs', app, document, {
        customSiteTitle: 'OpenPRA-MQ API Docs',
        explorer: true,
        swaggerOptions: {},
    });
    app.use(json({ limit: '50mb' }));
    app.use(urlencoded({ extended: true, limit: '50mb' }));
    logger.debug('Microservices have been initialized.');
    await app.listen(3000);
}
void bootstrap();

import { NestFactory } from '@nestjs/core';
// import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ApiModule } from './api.module';

/*
  - All the configurations for the Preflighted requests for this project are available under app.enableCors() method.
    These configurations tell the web-app that:
    1. All 'origins' are permitted to make requests to the URLs.
    2. All kinds of request methods are permitted on the URLs.
    3. Certain 'request headers' are permitted.
    4. These permissions can be cached for 24 hours.
    5. The OPTIONS request is going to be sent before accessing any URL.
    6. If the request is successful, a 200 response status will be sent back.
  - Automated documentation is generated for the web-app using OpenAPI (Swagger). All the configurations for Swagger are defined here as well.
  - The app is deployed on 8000 port. So the entrypoint for the app is: http://localhost:8000/api/
*/
async function bootstrap() {
  const app = await NestFactory.create(ApiModule);
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Accept', 'Accept-Encoding', 'Authorization', 'Content-Type', 'DNT', 'Origin', 'User-Agent', 'X-CSRFToken', 'X-Requested-With'],
    maxAge: 86400,
    preflightContinue: true,
    optionsSuccessStatus: 200
  });

  // const config = new DocumentBuilder()
  //   .setTitle('Web Backend Documentation')
  //   .setDescription('Automated Documentation for NestJS based Web-Backend')
  //   .setVersion('1.0')
  //   .build();
  // const document = SwaggerModule.createDocument(app, config);
  // SwaggerModule.setup('/api/docs', app, document, {
  //   swaggerOptions: { defaultModelsExpandDepth: -1 }
  // });

  await app.listen(8000);
}

bootstrap();

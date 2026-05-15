import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { INestApplication, Logger } from "@nestjs/common";
import { json, urlencoded } from "express";
import { HttpExceptionFilter } from "./http-exception.filter";
import { RaptorManagerModule } from "./raptor-manager.module";
const logger = new Logger("ProcessErrorHandler");
process.on("uncaughtException", (error: Error) => {
  logger.error("Uncaught Exception detected:", error);
  logger.error("Stack trace:", error.stack);
});
process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
  logger.error("Unhandled Rejection detected at:", promise);
  logger.error("Rejection reason:", reason);
});
async function bootstrap(): Promise<void> {
  const logger = new Logger();
  logger.debug("Initializing the app...");
  const app: INestApplication = await NestFactory.create(RaptorManagerModule);
  logger.debug("Attaching the exception filter...");
  app.useGlobalFilters(new HttpExceptionFilter());
  const hostUrl = process.env.HOST_URL || "http://localhost:3000";
  const isProduction = process.env.NODE_ENV === "production";
  const swaggerConfig = new DocumentBuilder()
    .setTitle("RAPTOR API")
    .setDescription(
      "Risk Assessment Parallel Task ORchestrator: A distributed microservice for Probabilistic Risk Assessment (PRA) quantification primarily using SCRAM engine with RabbitMQ based job orchestration and MinIO object storage.",
    )
    .setVersion("1.0.3")
    .setLicense("MIT", "https://opensource.org/license/mit/")
    .setContact("OpenPRA", "https://github.com/ncsu-ne-prag", "")
    .addServer(isProduction ? hostUrl : "http://localhost:3000")
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  logger.debug("Creating the API Documentation...");
  SwaggerModule.setup("/q/docs", app, document, {
    customSiteTitle: "RAPTOR API Documentation",
    explorer: true,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tagsSorter: "alpha",
      operationsSorter: "alpha",
    },
  });
  app.use(json({ limit: "50mb" }));
  app.use(urlencoded({ extended: true, limit: "50mb" }));
  logger.debug("Microservices have been initialized.");
  await app.listen(3000);
}
void bootstrap();

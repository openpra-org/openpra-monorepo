import { NestFactory } from "@nestjs/core";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { QuantificationConsumerModule } from "./quantification/quantification-consumer.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(QuantificationConsumerModule, {
    transport: Transport.RMQ,
    options: {
      urls: ["amqp://localhost:5672"],
    },
  });
  await app.listen();
}

void bootstrap();

import { NestFactory } from "@nestjs/core";
import { Transport, MicroserviceOptions } from "@nestjs/microservices";
import { QuantificationConsumerModule } from "./quantification/quantification-consumer.module";

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(QuantificationConsumerModule, {
    transport: Transport.RMQ,
    options: {
      urls: ["amqp://localhost:5672"],
      queue: "initial_quantification_queue",
      queueOptions: {
        durable: true,
        deadLetterExchange: "dead_letter_exchange",
        messageTtl: 60000,
        maxLength: 10000,
      },
    },
  });
  await app.listen();
}
void bootstrap();

import { Global, Module } from "@nestjs/common";
import { RabbitMQConnectionService } from "./rabbitmq-connection.service";
import { QueueService } from "./queue.service";
import { QueueConfigFactory } from "./queue-config.factory";

@Global()
@Module({
  providers: [RabbitMQConnectionService, QueueService, QueueConfigFactory],
  exports: [RabbitMQConnectionService, QueueService, QueueConfigFactory],
})
export class QueueModule {}

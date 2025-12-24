import { Global, Module } from '@nestjs/common';
import { RabbitMQChannelModelService } from './rabbitmq-channelModel.service';
import { QueueService } from './queue.service';
import { QueueConfigFactory } from './queue-config.factory';
import { MinioService } from './minio.service';

@Global()
@Module({
  providers: [
    RabbitMQChannelModelService,
    QueueService,
    QueueConfigFactory,
    MinioService,
  ],
  exports: [
    RabbitMQChannelModelService,
    QueueService,
    QueueConfigFactory,
    MinioService,
  ],
})
export class QueueModule {}

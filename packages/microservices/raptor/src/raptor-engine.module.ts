import fs from 'fs';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueueModule } from './shared';
import { ConsumerService } from './quantification/services/consumer.service';

@Module({
  imports: [
    QueueModule,
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
      cache: true,
      ignoreEnvFile: !fs.existsSync('.env'),
    }),
  ],
  providers: [ConsumerService],
})
export class RaptorEngineModule {}

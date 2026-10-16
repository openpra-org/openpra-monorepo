import fs from 'fs';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueueModule } from './shared';
import { ConsumerService } from './quantification/services/consumer.service';
import { PraxisJobConsumerService } from './execution/services/praxis-job-consumer.service';
import { PraxisJobStore } from './execution/praxis-job-store';
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
    providers: [ConsumerService, PraxisJobConsumerService, PraxisJobStore],
})
export class PraetorEngineModule {
}

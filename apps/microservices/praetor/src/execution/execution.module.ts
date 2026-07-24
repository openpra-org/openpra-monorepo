import { Module } from '@nestjs/common';
import { QueueModule } from '../shared';
import { ExecuteController } from './controllers/execute.controller';
import { ExecuteProducerService } from './services/execute-producer.service';
import { ExecuteStorageService } from './services/execute-storage.service';

@Module({
    imports: [QueueModule],
    controllers: [ExecuteController],
    providers: [ExecuteProducerService, ExecuteStorageService],
})
export class ExecutionModule {
}

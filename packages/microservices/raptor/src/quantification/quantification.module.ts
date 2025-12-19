import { Module } from '@nestjs/common';
import { QueueModule } from '../shared';
import { ScramController } from './controllers/scram.controller';
import { ProducerService } from './services/producer.service';
import { SequenceExtractorService } from './services/sequence-extractor';
import { StorageService } from './services/storage.service';

@Module({
  imports: [QueueModule],
  controllers: [ScramController],
  providers: [ProducerService, SequenceExtractorService, StorageService],
  exports: [StorageService],
})
export class QuantificationModule {}

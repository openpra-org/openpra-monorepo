import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ScramController } from "./controllers/scram.controller";
import { FtrexController } from "./controllers/ftrex.controller";
import { ProducerService } from "./services/producer.service";
import { ConsumerService } from "./services/consumer.service";
import { StorageService } from "./services/storage.service";
import { QuantifiedReport, QuantifiedReportSchema } from "./schemas/quantified-report.schema";

@Module({
  imports: [MongooseModule.forFeature([{ name: QuantifiedReport.name, schema: QuantifiedReportSchema }])],
  controllers: [ScramController, FtrexController],
  providers: [ProducerService, ConsumerService, StorageService],
})
export class QuantificationModule {}

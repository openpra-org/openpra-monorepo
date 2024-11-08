import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ScramController } from "./controllers/scram.controller";
import { FtrexController } from "./controllers/ftrex.controller";
import { ProducerService } from "./services/producer.service";
import { StorageService } from "./services/storage.service";
import { QuantifiedReport, QuantifiedReportSchema } from "./schemas/quantified-report.schema";

@Module({
  // Register the Mongoose schema for QuantifiedReport to enable MongoDB persistence.
  imports: [MongooseModule.forFeature([{ name: QuantifiedReport.name, schema: QuantifiedReportSchema }])],
  // Define controllers to handle requests for SCRAM and FTREX functionalities.
  controllers: [ScramController, FtrexController],
  // Register services to provide business logic for quantification operations.
  providers: [ProducerService, StorageService],
})
export class QuantificationModule {}

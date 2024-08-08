import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { APP_FILTER } from "@nestjs/core";
import { HttpExceptionFilter } from "../exception-filters/http-exception.filter";
import { RmqExceptionFilter } from "../exception-filters/rmq-exception.filter";
import { ScramController } from "./controllers/scram.controller";
import { FtrexController } from "./controllers/ftrex.controller";
import { ProducerService } from "./services/producer.service";
import { ConsumerService } from "./services/consumer.service";
import { StorageService } from "./services/storage.service";
import { QuantifiedReport, QuantifiedReportSchema } from "./schemas/quantified-report.schema";

@Module({
  imports: [MongooseModule.forFeature([{ name: QuantifiedReport.name, schema: QuantifiedReportSchema }])],
  controllers: [ScramController, FtrexController],
  providers: [
    ProducerService,
    ConsumerService,
    StorageService,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: RmqExceptionFilter,
    },
  ],
})
export class QuantificationModule {}

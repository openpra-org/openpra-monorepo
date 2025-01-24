import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { EnvVarKeys } from "../../config/env_vars.config";
import { QuantificationJobReport, QuantificationJobSchema } from "../middleware/schemas/quantification-job.schema";
import { ConsumerService } from "./services/consumer.service";

@Module({
  imports: [
    MongooseModule.forRoot(EnvVarKeys.MONGODB_URI),
    MongooseModule.forFeature([{ name: QuantificationJobReport.name, schema: QuantificationJobSchema }]),
  ],
  providers: [ConsumerService],
})
export class QuantificationConsumerModule {}

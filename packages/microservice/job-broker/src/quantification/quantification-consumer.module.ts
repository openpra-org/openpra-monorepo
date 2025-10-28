import fs from "fs";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";

import { QuantificationJobReport, QuantificationJobSchema } from "../middleware/schemas/quantification-job.schema";
import { ConsumerService } from "./services/consumer.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ".env",
      isGlobal: true,
      cache: true,
      ignoreEnvFile: !fs.existsSync(".env"),
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>("MONGO_URL"),
      }),
    }),
    MongooseModule.forFeature([{ name: QuantificationJobReport.name, schema: QuantificationJobSchema }]),
  ],
  providers: [ConsumerService],
})
/**
 * Standalone module for running the quantification consumer worker process.
 */
export class QuantificationConsumerModule {}

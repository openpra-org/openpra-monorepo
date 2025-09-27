import fs from "fs";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { QueueModule } from "./shared";
import { ConsumerService } from "./quantification/services/consumer.service";
import { QuantificationJobReport, QuantificationJobSchema } from "./middleware/schemas/quantification-job.schema";
import { ExecutableJobReport, ExecutableJobSchema } from "./middleware/schemas/executable-job.schema";
import { ExecutableWorkerService } from "./executable/services/executable-worker.service";

@Module({
  imports: [
    QueueModule,
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
    MongooseModule.forFeature([
      { name: QuantificationJobReport.name, schema: QuantificationJobSchema },
      { name: ExecutableJobReport.name, schema: ExecutableJobSchema },
    ]),
  ],
  providers: [ConsumerService, ExecutableWorkerService],
})
export class JobBrokerConsumerModule {}

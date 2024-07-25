import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { RouterModule } from "@nestjs/core";
import { ScramController } from "./controllers/scram.controller";
import { FtrexController } from "./controllers/ftrex.controller";
import { ProducerService } from "./services/producer.service";
import { LocalDispatchService } from "./services/local-dispatch.service";
import { ConsumerService } from "./services/consumer.service";
import { StorageService } from "./services/storage.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ".development.env",
      isGlobal: true,
      cache: true,
      ignoreEnvFile: !!process.env.DEPLOYMENT,
    }),
    RouterModule.register([
      {
        path: "quantification",
        module: QuantificationModule,
      },
    ]),
  ],
  controllers: [ScramController, FtrexController],
  providers: [ProducerService, LocalDispatchService, ConsumerService, StorageService],
})
export class QuantificationModule {}

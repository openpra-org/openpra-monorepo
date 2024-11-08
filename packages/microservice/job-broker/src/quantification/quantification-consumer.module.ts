import { Module } from "@nestjs/common";
import { ConsumerService } from "./services/consumer.service";

@Module({
  providers: [ConsumerService],
})
export class QuantificationConsumerModule {}

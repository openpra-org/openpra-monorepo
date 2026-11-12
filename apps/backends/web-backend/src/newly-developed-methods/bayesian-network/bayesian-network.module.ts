import { Module } from "@nestjs/common";
import { NetworkBuilderController } from "./network-builder/network-builder.controller";
import { NetworkBuilderService } from "./network-builder/network-builder.service";

@Module({
  controllers: [NetworkBuilderController],
  providers: [NetworkBuilderService],
})
export class BayesianNetworkModule {}

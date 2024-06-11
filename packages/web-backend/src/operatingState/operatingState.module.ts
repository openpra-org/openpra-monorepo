import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { OperatingState, OperatingStateSchema } from "../schemas/operatingState.schema";
import { OperatingStateController } from "./OperatingStateController";
import { OperatingStateService } from "./OperatingStateService";

@Module({
  imports: [MongooseModule.forFeature([{ name: OperatingState.name, schema: OperatingStateSchema }])],
  controllers: [OperatingStateController],
  providers: [OperatingStateService],
  exports: [OperatingStateService],
})
export class OperatingStateModule {}

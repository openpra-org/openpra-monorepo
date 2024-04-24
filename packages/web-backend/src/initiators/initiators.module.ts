import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { InitiatorService } from "./initiators.service";
import { InitiatorController } from "./initiators.controller";
import { Initiator, InitiatorSchema } from "./schemas/initiator.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
        { name: Initiator.name, schema: InitiatorSchema },
    ]),
  ],
  controllers: [InitiatorController],
  providers: [InitiatorService],
  exports: [InitiatorService],
})
export class InitiatorModule {}

import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  InitiatingEvent,
  InitiatingEventSchema,
} from "../nestedModels/schemas/initiating-event.schema";
import {
  InitiatingEventGroup,
  InitiatingEventGroupSchema,
} from "./schemas/initiatingEventGroup.schema";
import { InitiatingEventGroupService } from "./initiatingEventGroup.service";
import { InitiatingEventGroupController } from "./initiatingEventGroup.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: InitiatingEvent.name, schema: InitiatingEventSchema },
      { name: InitiatingEventGroup.name, schema: InitiatingEventGroupSchema },
    ]),
  ],
  controllers: [InitiatingEventGroupController],
  providers: [InitiatingEventGroupService],
  exports: [InitiatingEventGroupService],
})
export class InitiatingEventGroupModule {}

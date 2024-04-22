import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { InitiatingEventGroup, InitiatingEventGroupSchema } from "./schemas/initiatingEventGroup.schema";
import { InitiatingEventGroupService } from "./initiatingEventGroup.service";
import { InitiatingEventGroupController } from "./initiatingEventGroup.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
        { name: InitiatingEventGroup.name, schema: InitiatingEventGroupSchema },
    ]),
  ],
  controllers: [InitiatingEventGroupController],
  providers: [InitiatingEventGroupService],
  exports: [InitiatingEventGroupService],
})
export class InitiatingEventGroupModule {}

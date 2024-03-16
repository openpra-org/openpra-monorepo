import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { CollabController } from "./collab.controller";
import { CollabService } from "./collab.service";
import { UserCounter, UserCounterSchema } from "./schemas/user-counter.schema";
import { User, UserSchema } from "./schemas/user.schema";
import {UserSideNavPreferences, UserSideNavTabSchema} from "../typedModel/schemas/side-nav-tabs.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserCounter.name, schema: UserCounterSchema },
      { name: User.name, schema: UserSchema },
      { name: UserSideNavPreferences.name, schema: UserSideNavTabSchema}
    ]),
  ],
  controllers: [CollabController],
  providers: [CollabService],
  exports: [CollabService],
})
export class CollabModule {}

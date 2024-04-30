import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { InvitedUser, InvitedUserSchema } from "./schemas/invite.schema";
import { InviteController } from "./invite.controller";
import { InviteService } from "./invite.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: InvitedUser.name, schema: InvitedUserSchema },
    ]),
  ],
  controllers: [InviteController],
  providers: [InviteService],
  exports: [InviteService],
})
export class InviteModule {}

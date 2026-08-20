import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Organization, OrganizationSchema } from "./organization.schema";
import { User, UserSchema } from "../users/user.schema";
import { Team, TeamSchema } from "../teams/team.schema";
import { OrgsService } from "./orgs.service";
import { OrgsController } from "./orgs.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Organization.name, schema: OrganizationSchema },
      { name: User.name, schema: UserSchema },
      { name: Team.name, schema: TeamSchema },
    ]),
  ],
  controllers: [OrgsController],
  providers: [OrgsService],
  exports: [OrgsService],
})
export class OrgsModule {}

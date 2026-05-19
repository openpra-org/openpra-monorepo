import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Team, TeamSchema } from "./team.schema";
import { User, UserSchema } from "../users/user.schema";
import { TeamsController } from "./teams.controller";
import { TeamsService } from "./teams.service";
import { OrgsModule } from "../orgs/orgs.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Team.name, schema: TeamSchema },
      { name: User.name, schema: UserSchema },
    ]),
    OrgsModule,
  ],
  controllers: [TeamsController],
  providers: [TeamsService],
})
export class TeamsModule {}

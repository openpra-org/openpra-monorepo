import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "./user.schema";
import { Project, ProjectSchema } from "../projects/project.schema";
import { Team, TeamSchema } from "../teams/team.schema";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { StorageService } from "./storage.service";
import { OrgsModule } from "../orgs/orgs.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Project.name, schema: ProjectSchema },
      { name: Team.name, schema: TeamSchema },
    ]),
    OrgsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, StorageService],
})
export class UsersModule {}

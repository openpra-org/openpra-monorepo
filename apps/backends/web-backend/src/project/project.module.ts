import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "../auth/user.schema";
import { Project, ProjectSchema } from "./project.schema";
import { ProjectController } from "./project.controller";
import { ProjectService } from "./project.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [ProjectController],
  providers: [ProjectService],
})
export class ProjectModule {}

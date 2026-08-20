import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuditLog, AuditLogSchema } from "./audit-log.schema";
import { Team, TeamSchema } from "../teams/team.schema";
import { Project, ProjectSchema } from "../projects/project.schema";
import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuditLog.name, schema: AuditLogSchema },
      { name: Team.name, schema: TeamSchema },
      { name: Project.name, schema: ProjectSchema },
    ]),
  ],
  controllers: [AuditController],
  providers: [AuditService],
})
export class AuditModule {}

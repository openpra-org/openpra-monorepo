import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "../users/user.schema";
import { Team, TeamSchema } from "../teams/team.schema";
import { ProjectsModule } from "../projects/projects.module";
import { Workbook, WorkbookSchema } from "./workbook.schema";
import { WorkbookRole, WorkbookRoleSchema } from "./workbook-role.schema";
import { WorkbookSignoff, WorkbookSignoffSchema } from "./workbook-signoff.schema";
import { WorkbooksController } from "./workbooks.controller";
import { WorkbooksService } from "./workbooks.service";
import { WorkbookReviewController } from "./workbook-review.controller";
import { WorkbookRolesService } from "./workbook-roles.service";
import { WorkbookWorkflowService } from "./workbook-workflow.service";
import { WorkbookCommentsService } from "./workbook-comments.service";
import { WorkbookElementRegistry } from "./workbook-element-registry";
import { WorkbookModelAccessService } from "./workbook-model-access.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Workbook.name, schema: WorkbookSchema },
      { name: WorkbookRole.name, schema: WorkbookRoleSchema },
      { name: WorkbookSignoff.name, schema: WorkbookSignoffSchema },
      { name: User.name, schema: UserSchema },
      { name: Team.name, schema: TeamSchema },
    ]),
    ProjectsModule,
  ],
  controllers: [WorkbooksController, WorkbookReviewController],
  providers: [
    WorkbooksService,
    WorkbookRolesService,
    WorkbookWorkflowService,
    WorkbookCommentsService,
    WorkbookElementRegistry,
    WorkbookModelAccessService,
  ],
  exports: [
    MongooseModule,
    WorkbookRolesService,
    WorkbookElementRegistry,
    WorkbookModelAccessService,
  ],
})
export class WorkbooksModule {}

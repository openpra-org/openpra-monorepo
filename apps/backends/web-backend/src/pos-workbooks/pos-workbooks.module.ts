import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ProjectsModule } from "../projects/projects.module";
import { ExampleWorkbooksModule } from "../example-workbooks/example-workbooks.module";
import { User, UserSchema } from "../users/user.schema";
import { PosWorkbook, PosWorkbookSchema } from "./pos-workbook.schema";
import { PosWorkbookRole, PosWorkbookRoleSchema } from "./pos-workbook-role.schema";
import { PosWorkbookSignoff, PosWorkbookSignoffSchema } from "./pos-workbook-signoff.schema";
import { PosWorkbookFile, PosWorkbookFileSchema } from "./pos-workbook-document.schema";
import { PosWorkbooksController } from "./pos-workbooks.controller";
import { PosWorkbooksService } from "./pos-workbooks.service";
import { PosRolesController } from "./pos-roles.controller";
import { PosRolesService } from "./pos-roles.service";
import { PosCommentsController } from "./pos-comments.controller";
import { PosCommentsService } from "./pos-comments.service";
import { PosWorkflowController } from "./pos-workflow.controller";
import { PosWorkflowService } from "./pos-workflow.service";
import { PosDocumentsController } from "./pos-documents.controller";
import { PosDocumentsService } from "./pos-documents.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PosWorkbook.name, schema: PosWorkbookSchema },
      { name: PosWorkbookRole.name, schema: PosWorkbookRoleSchema },
      { name: PosWorkbookSignoff.name, schema: PosWorkbookSignoffSchema },
      { name: PosWorkbookFile.name, schema: PosWorkbookFileSchema },
      { name: User.name, schema: UserSchema },
    ]),
    ProjectsModule,
    ExampleWorkbooksModule,
  ],
  controllers: [PosWorkflowController, PosWorkbooksController, PosRolesController, PosCommentsController, PosDocumentsController],
  providers: [PosWorkbooksService, PosRolesService, PosCommentsService, PosWorkflowService, PosDocumentsService],
  exports: [PosWorkbooksService, PosRolesService, PosCommentsService, PosWorkflowService, PosDocumentsService],
})
export class PosWorkbooksModule {}

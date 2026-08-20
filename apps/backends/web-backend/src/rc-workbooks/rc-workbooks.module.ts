import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ProjectsModule } from "../projects/projects.module";
import { ExampleWorkbooksModule } from "../example-workbooks/example-workbooks.module";
import { WorkbooksModule } from "../workbooks/workbooks.module";
import { RcWorkbook, RcWorkbookSchema } from "./rc-workbook.schema";
import { RcWorkbookFile, RcWorkbookFileSchema } from "./rc-workbook-document.schema";
import { RcWorkbooksController } from "./rc-workbooks.controller";
import { RcWorkbooksService } from "./rc-workbooks.service";
import { RcMefAdapter } from "./rc-mef-adapter";
import { RcDocumentsController } from "./rc-documents.controller";
import { RcDocumentsService } from "./rc-documents.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RcWorkbook.name, schema: RcWorkbookSchema },
      { name: RcWorkbookFile.name, schema: RcWorkbookFileSchema },
    ]),
    ProjectsModule,
    ExampleWorkbooksModule,
    WorkbooksModule,
  ],
  controllers: [RcWorkbooksController, RcDocumentsController],
  providers: [RcWorkbooksService, RcMefAdapter, RcDocumentsService],
  exports: [RcWorkbooksService, RcDocumentsService],
})
export class RcWorkbooksModule {}

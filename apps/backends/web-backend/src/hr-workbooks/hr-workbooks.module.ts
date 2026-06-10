import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ProjectsModule } from "../projects/projects.module";
import { ExampleWorkbooksModule } from "../example-workbooks/example-workbooks.module";
import { WorkbooksModule } from "../workbooks/workbooks.module";
import { HrWorkbook, HrWorkbookSchema } from "./hr-workbook.schema";
import { HrWorkbookFile, HrWorkbookFileSchema } from "./hr-workbook-document.schema";
import { HrWorkbooksController } from "./hr-workbooks.controller";
import { HrWorkbooksService } from "./hr-workbooks.service";
import { HrMefAdapter } from "./hr-mef-adapter";
import { HrDocumentsController } from "./hr-documents.controller";
import { HrDocumentsService } from "./hr-documents.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HrWorkbook.name, schema: HrWorkbookSchema },
      { name: HrWorkbookFile.name, schema: HrWorkbookFileSchema },
    ]),
    ProjectsModule,
    ExampleWorkbooksModule,
    WorkbooksModule,
  ],
  controllers: [HrWorkbooksController, HrDocumentsController],
  providers: [HrWorkbooksService, HrMefAdapter, HrDocumentsService],
  exports: [HrWorkbooksService, HrDocumentsService],
})
export class HrWorkbooksModule {}

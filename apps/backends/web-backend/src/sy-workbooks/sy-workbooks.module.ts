import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ProjectsModule } from "../projects/projects.module";
import { ExampleWorkbooksModule } from "../example-workbooks/example-workbooks.module";
import { WorkbooksModule } from "../workbooks/workbooks.module";
import { SyWorkbook, SyWorkbookSchema } from "./sy-workbook.schema";
import { SyWorkbookFile, SyWorkbookFileSchema } from "./sy-workbook-document.schema";
import { SyWorkbooksController } from "./sy-workbooks.controller";
import { SyWorkbooksService } from "./sy-workbooks.service";
import { SyMefAdapter } from "./sy-mef-adapter";
import { SyDocumentsController } from "./sy-documents.controller";
import { SyDocumentsService } from "./sy-documents.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SyWorkbook.name, schema: SyWorkbookSchema },
      { name: SyWorkbookFile.name, schema: SyWorkbookFileSchema },
    ]),
    ProjectsModule,
    ExampleWorkbooksModule,
    WorkbooksModule,
  ],
  controllers: [SyWorkbooksController, SyDocumentsController],
  providers: [SyWorkbooksService, SyMefAdapter, SyDocumentsService],
  exports: [SyWorkbooksService, SyDocumentsService],
})
export class SyWorkbooksModule {}

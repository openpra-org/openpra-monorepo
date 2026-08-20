import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ProjectsModule } from "../projects/projects.module";
import { ExampleWorkbooksModule } from "../example-workbooks/example-workbooks.module";
import { WorkbooksModule } from "../workbooks/workbooks.module";
import { PosWorkbook, PosWorkbookSchema } from "./pos-workbook.schema";
import { PosWorkbookFile, PosWorkbookFileSchema } from "./pos-workbook-document.schema";
import { PosWorkbooksController } from "./pos-workbooks.controller";
import { PosWorkbooksService } from "./pos-workbooks.service";
import { PosDocumentsController } from "./pos-documents.controller";
import { PosDocumentsService } from "./pos-documents.service";
import { PosMefAdapter } from "./pos-mef-adapter";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PosWorkbook.name, schema: PosWorkbookSchema },
      { name: PosWorkbookFile.name, schema: PosWorkbookFileSchema },
    ]),
    ProjectsModule,
    ExampleWorkbooksModule,
    WorkbooksModule,
  ],
  controllers: [PosWorkbooksController, PosDocumentsController],
  providers: [PosWorkbooksService, PosDocumentsService, PosMefAdapter],
  exports: [PosWorkbooksService, PosDocumentsService, MongooseModule],
})
export class PosWorkbooksModule {}

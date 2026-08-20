import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ProjectsModule } from "../projects/projects.module";
import { ExampleWorkbooksModule } from "../example-workbooks/example-workbooks.module";
import { WorkbooksModule } from "../workbooks/workbooks.module";
import { DaWorkbook, DaWorkbookSchema } from "./da-workbook.schema";
import { DaWorkbookFile, DaWorkbookFileSchema } from "./da-workbook-document.schema";
import { DaWorkbooksController } from "./da-workbooks.controller";
import { DaWorkbooksService } from "./da-workbooks.service";
import { DaMefAdapter } from "./da-mef-adapter";
import { DaDocumentsController } from "./da-documents.controller";
import { DaDocumentsService } from "./da-documents.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DaWorkbook.name, schema: DaWorkbookSchema },
      { name: DaWorkbookFile.name, schema: DaWorkbookFileSchema },
    ]),
    ProjectsModule,
    ExampleWorkbooksModule,
    WorkbooksModule,
  ],
  controllers: [DaWorkbooksController, DaDocumentsController],
  providers: [DaWorkbooksService, DaMefAdapter, DaDocumentsService],
  exports: [DaWorkbooksService, DaDocumentsService],
})
export class DaWorkbooksModule {}

import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ProjectsModule } from "../projects/projects.module";
import { ExampleWorkbooksModule } from "../example-workbooks/example-workbooks.module";
import { WorkbooksModule } from "../workbooks/workbooks.module";
import { RiWorkbook, RiWorkbookSchema } from "./ri-workbook.schema";
import { RiWorkbookFile, RiWorkbookFileSchema } from "./ri-workbook-document.schema";
import { RiWorkbooksController } from "./ri-workbooks.controller";
import { RiWorkbooksService } from "./ri-workbooks.service";
import { RiMefAdapter } from "./ri-mef-adapter";
import { RiDocumentsController } from "./ri-documents.controller";
import { RiDocumentsService } from "./ri-documents.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RiWorkbook.name, schema: RiWorkbookSchema },
      { name: RiWorkbookFile.name, schema: RiWorkbookFileSchema },
    ]),
    ProjectsModule,
    ExampleWorkbooksModule,
    WorkbooksModule,
  ],
  controllers: [RiWorkbooksController, RiDocumentsController],
  providers: [RiWorkbooksService, RiMefAdapter, RiDocumentsService],
  exports: [RiWorkbooksService, RiDocumentsService],
})
export class RiWorkbooksModule {}

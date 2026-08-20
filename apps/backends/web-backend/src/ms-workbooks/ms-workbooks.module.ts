import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ProjectsModule } from "../projects/projects.module";
import { ExampleWorkbooksModule } from "../example-workbooks/example-workbooks.module";
import { WorkbooksModule } from "../workbooks/workbooks.module";
import { MsWorkbook, MsWorkbookSchema } from "./ms-workbook.schema";
import { MsWorkbookFile, MsWorkbookFileSchema } from "./ms-workbook-document.schema";
import { MsWorkbooksController } from "./ms-workbooks.controller";
import { MsWorkbooksService } from "./ms-workbooks.service";
import { MsMefAdapter } from "./ms-mef-adapter";
import { MsDocumentsController } from "./ms-documents.controller";
import { MsDocumentsService } from "./ms-documents.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MsWorkbook.name, schema: MsWorkbookSchema },
      { name: MsWorkbookFile.name, schema: MsWorkbookFileSchema },
    ]),
    ProjectsModule,
    ExampleWorkbooksModule,
    WorkbooksModule,
  ],
  controllers: [MsWorkbooksController, MsDocumentsController],
  providers: [MsWorkbooksService, MsMefAdapter, MsDocumentsService],
  exports: [MsWorkbooksService, MsDocumentsService],
})
export class MsWorkbooksModule {}

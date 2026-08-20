import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ProjectsModule } from "../projects/projects.module";
import { ExampleWorkbooksModule } from "../example-workbooks/example-workbooks.module";
import { WorkbooksModule } from "../workbooks/workbooks.module";
import { ScWorkbook, ScWorkbookSchema } from "./sc-workbook.schema";
import { ScWorkbookFile, ScWorkbookFileSchema } from "./sc-workbook-document.schema";
import { ScWorkbooksController } from "./sc-workbooks.controller";
import { ScWorkbooksService } from "./sc-workbooks.service";
import { ScMefAdapter } from "./sc-mef-adapter";
import { ScDocumentsController } from "./sc-documents.controller";
import { ScDocumentsService } from "./sc-documents.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ScWorkbook.name, schema: ScWorkbookSchema },
      { name: ScWorkbookFile.name, schema: ScWorkbookFileSchema },
    ]),
    ProjectsModule,
    ExampleWorkbooksModule,
    WorkbooksModule,
  ],
  controllers: [ScWorkbooksController, ScDocumentsController],
  providers: [ScWorkbooksService, ScMefAdapter, ScDocumentsService],
  exports: [ScWorkbooksService, ScDocumentsService],
})
export class ScWorkbooksModule {}

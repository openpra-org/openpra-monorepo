import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ProjectsModule } from "../projects/projects.module";
import { ExampleWorkbooksModule } from "../example-workbooks/example-workbooks.module";
import { WorkbooksModule } from "../workbooks/workbooks.module";
import { EsqWorkbook, EsqWorkbookSchema } from "./esq-workbook.schema";
import { EsqWorkbookFile, EsqWorkbookFileSchema } from "./esq-workbook-document.schema";
import { EsqWorkbooksController } from "./esq-workbooks.controller";
import { EsqWorkbooksService } from "./esq-workbooks.service";
import { EsqMefAdapter } from "./esq-mef-adapter";
import { EsqDocumentsController } from "./esq-documents.controller";
import { EsqDocumentsService } from "./esq-documents.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EsqWorkbook.name, schema: EsqWorkbookSchema },
      { name: EsqWorkbookFile.name, schema: EsqWorkbookFileSchema },
    ]),
    ProjectsModule,
    ExampleWorkbooksModule,
    WorkbooksModule,
  ],
  controllers: [EsqWorkbooksController, EsqDocumentsController],
  providers: [EsqWorkbooksService, EsqMefAdapter, EsqDocumentsService],
  exports: [EsqWorkbooksService, EsqDocumentsService],
})
export class EsqWorkbooksModule {}

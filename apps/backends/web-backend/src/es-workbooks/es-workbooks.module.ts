import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ProjectsModule } from "../projects/projects.module";
import { ExampleWorkbooksModule } from "../example-workbooks/example-workbooks.module";
import { WorkbooksModule } from "../workbooks/workbooks.module";
import { PosWorkbooksModule } from "../pos-workbooks/pos-workbooks.module";
import { IeWorkbooksModule } from "../ie-workbooks/ie-workbooks.module";
import { IeWorkbook, IeWorkbookSchema } from "../ie-workbooks/ie-workbook.schema";
import { EsWorkbook, EsWorkbookSchema } from "./es-workbook.schema";
import { EsWorkbookFile, EsWorkbookFileSchema } from "./es-workbook-document.schema";
import { EsWorkbooksController } from "./es-workbooks.controller";
import { EsWorkbooksService } from "./es-workbooks.service";
import { EsDocumentsController } from "./es-documents.controller";
import { EsDocumentsService } from "./es-documents.service";
import { EsUpstreamLinkController } from "./es-upstream-link.controller";
import { EsUpstreamLinkService } from "./es-upstream-link.service";
import { EsMefAdapter } from "./es-mef-adapter";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EsWorkbook.name, schema: EsWorkbookSchema },
      { name: EsWorkbookFile.name, schema: EsWorkbookFileSchema },
      { name: IeWorkbook.name, schema: IeWorkbookSchema },
    ]),
    ProjectsModule,
    ExampleWorkbooksModule,
    WorkbooksModule,
    PosWorkbooksModule,
    IeWorkbooksModule,
  ],
  controllers: [EsWorkbooksController, EsDocumentsController, EsUpstreamLinkController],
  providers: [EsWorkbooksService, EsDocumentsService, EsUpstreamLinkService, EsMefAdapter],
  exports: [EsWorkbooksService, EsDocumentsService],
})
export class EsWorkbooksModule {}

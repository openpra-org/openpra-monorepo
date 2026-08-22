import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ProjectsModule } from "../projects/projects.module";
import { ExampleWorkbooksModule } from "../example-workbooks/example-workbooks.module";
import { WorkbooksModule } from "../workbooks/workbooks.module";
import { PosWorkbooksModule } from "../pos-workbooks/pos-workbooks.module";
import { IeWorkbooksModule } from "../ie-workbooks/ie-workbooks.module";
import { EsWorkbook, EsWorkbookSchema } from "./es-workbook.schema";
import { EsWorkbookFile, EsWorkbookFileSchema } from "./es-workbook-document.schema";
import { EsWorkbooksController } from "./es-workbooks.controller";
import { EsWorkbooksService } from "./es-workbooks.service";
import { EsMefAdapter } from "./es-mef-adapter";
import { EsPosLinkController } from "./es-pos-link.controller";
import { EsPosLinkService } from "./es-pos-link.service";
import { EsIeLinkController } from "./es-ie-link.controller";
import { EsIeLinkService } from "./es-ie-link.service";
import { EsDocumentsController } from "./es-documents.controller";
import { EsDocumentsService } from "./es-documents.service";
import { NewlyDevelopedMethodsSharedModule } from "../newly-developed-methods/shared/newly-developed-methods-shared.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EsWorkbook.name, schema: EsWorkbookSchema },
      { name: EsWorkbookFile.name, schema: EsWorkbookFileSchema },
    ]),
    ProjectsModule,
    ExampleWorkbooksModule,
    WorkbooksModule,
    PosWorkbooksModule,
    IeWorkbooksModule,
    NewlyDevelopedMethodsSharedModule,
  ],
  controllers: [EsWorkbooksController, EsPosLinkController, EsIeLinkController, EsDocumentsController],
  providers: [EsWorkbooksService, EsMefAdapter, EsPosLinkService, EsIeLinkService, EsDocumentsService],
  exports: [EsWorkbooksService, EsDocumentsService],
})
export class EsWorkbooksModule {}

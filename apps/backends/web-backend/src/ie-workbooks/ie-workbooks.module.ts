import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ProjectsModule } from "../projects/projects.module";
import { ExampleWorkbooksModule } from "../example-workbooks/example-workbooks.module";
import { WorkbooksModule } from "../workbooks/workbooks.module";
import { PosWorkbooksModule } from "../pos-workbooks/pos-workbooks.module";
import { IeWorkbook, IeWorkbookSchema } from "./ie-workbook.schema";
import { IeWorkbookFile, IeWorkbookFileSchema } from "./ie-workbook-document.schema";
import { IeWorkbooksController } from "./ie-workbooks.controller";
import { IeWorkbooksService } from "./ie-workbooks.service";
import { IeDocumentsController } from "./ie-documents.controller";
import { IeDocumentsService } from "./ie-documents.service";
import { IePosLinkController } from "./ie-pos-link.controller";
import { IePosLinkService } from "./ie-pos-link.service";
import { IeMefAdapter } from "./ie-mef-adapter";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: IeWorkbook.name, schema: IeWorkbookSchema },
      { name: IeWorkbookFile.name, schema: IeWorkbookFileSchema },
    ]),
    ProjectsModule,
    ExampleWorkbooksModule,
    WorkbooksModule,
    PosWorkbooksModule,
  ],
  controllers: [IeWorkbooksController, IeDocumentsController, IePosLinkController],
  providers: [IeWorkbooksService, IeDocumentsService, IePosLinkService, IeMefAdapter],
  exports: [IeWorkbooksService, IeDocumentsService, MongooseModule],
})
export class IeWorkbooksModule {}

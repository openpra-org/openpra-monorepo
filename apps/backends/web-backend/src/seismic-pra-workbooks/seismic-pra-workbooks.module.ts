import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ExampleWorkbooksModule } from "../example-workbooks/example-workbooks.module";
import { ProjectsModule } from "../projects/projects.module";
import { WorkbooksModule } from "../workbooks/workbooks.module";
import { SeismicPraDocumentsController } from "./seismic-pra-documents.controller";
import { SeismicPraDocumentsService } from "./seismic-pra-documents.service";
import { SeismicPraMefAdapter } from "./seismic-pra-mef-adapter";
import { SeismicPraWorkbookFile, SeismicPraWorkbookFileSchema } from "./seismic-pra-workbook-document.schema";
import { SeismicPraWorkbook, SeismicPraWorkbookSchema } from "./seismic-pra-workbook.schema";
import { SeismicPraWorkbooksController } from "./seismic-pra-workbooks.controller";
import { SeismicPraWorkbooksService } from "./seismic-pra-workbooks.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SeismicPraWorkbook.name, schema: SeismicPraWorkbookSchema },
      { name: SeismicPraWorkbookFile.name, schema: SeismicPraWorkbookFileSchema },
    ]),
    ProjectsModule,
    ExampleWorkbooksModule,
    WorkbooksModule,
  ],
  controllers: [SeismicPraWorkbooksController, SeismicPraDocumentsController],
  providers: [SeismicPraWorkbooksService, SeismicPraMefAdapter, SeismicPraDocumentsService],
  exports: [SeismicPraWorkbooksService, SeismicPraDocumentsService],
})
export class SeismicPraWorkbooksModule {}

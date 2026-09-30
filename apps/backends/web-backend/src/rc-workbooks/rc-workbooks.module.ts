import { RcPublishedExampleService } from "./rc-published-example.service";
import { RcCaseRecordsService } from "./rc-case-records.service";
import { RcCaseRecordsController } from "./rc-case-records.controller";
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ProjectsModule } from "../projects/projects.module";
import { ExampleWorkbooksModule } from "../example-workbooks/example-workbooks.module";
import { WorkbooksModule } from "../workbooks/workbooks.module";
import { RcWorkbook, RcWorkbookSchema } from "./rc-workbook.schema";
import { RcWorkbookFile, RcWorkbookFileSchema } from "./rc-workbook-document.schema";
import { RcWorkbooksController } from "./rc-workbooks.controller";
import { RcWorkbooksService } from "./rc-workbooks.service";
import { RcMefAdapter } from "./rc-mef-adapter";
import { RcDocumentsController } from "./rc-documents.controller";
import { RcDocumentsService } from "./rc-documents.service";
import { RcSourceTermService } from "./rc-source-term.service";
import { RcSourceTermController } from "./rc-source-term.controller";
import { RcSiteReceptorsController } from "./rc-site-receptors.controller";
import { RcSiteReceptorsService } from "./rc-site-receptors.service";
import { RcEarlyResponseController } from "./rc-early-response.controller";
import { RcEarlyResponseService } from "./rc-early-response.service";
import { RcWeatherController } from "./rc-weather.controller";
import { RcWeatherService } from "./rc-weather.service";
import { RcTransportController } from "./rc-transport.controller";
import { RcDoseInputsService } from "./rc-dose-inputs.service";
import { RcDoseInputsController } from "./rc-dose-inputs.controller";
import { RcTransportService } from "./rc-transport.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RcWorkbook.name, schema: RcWorkbookSchema },
      { name: RcWorkbookFile.name, schema: RcWorkbookFileSchema },
    ]),
    ProjectsModule,
    ExampleWorkbooksModule,
    WorkbooksModule,
  ],
  controllers: [RcCaseRecordsController, RcWorkbooksController, RcDocumentsController, RcSourceTermController, RcSiteReceptorsController, RcEarlyResponseController, RcWeatherController, RcTransportController, RcDoseInputsController],
  providers: [RcPublishedExampleService, RcCaseRecordsService, RcWorkbooksService, RcMefAdapter, RcDocumentsService, RcSourceTermService, RcSiteReceptorsService, RcEarlyResponseService, RcWeatherService, RcTransportService, RcDoseInputsService],
  exports: [RcWorkbooksService, RcDocumentsService],
})
export class RcWorkbooksModule {}

import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AnalysisRunRecord, AnalysisRunRecordSchema } from "./analysis-run-record.schema";
import { PraetorAnalysisClient } from "./praetor-analysis.client";
import { WorkbooksModule } from "../../workbooks/workbooks.module";
import { SyWorkbook, SyWorkbookSchema } from "../../sy-workbooks/sy-workbook.schema";
import { EsWorkbook, EsWorkbookSchema } from "../../es-workbooks/es-workbook.schema";
import { EsqWorkbook, EsqWorkbookSchema } from "../../esq-workbooks/esq-workbook.schema";
import { DaWorkbook, DaWorkbookSchema } from "../../da-workbooks/da-workbook.schema";
import { HrWorkbook, HrWorkbookSchema } from "../../hr-workbooks/hr-workbook.schema";
import { ScWorkbook, ScWorkbookSchema } from "../../sc-workbooks/sc-workbook.schema";
import { WorkbookDependencyDiscoveryService } from "./workbook-dependency-discovery.service";
import { WorkbookAnalysisRunsService } from "./workbook-analysis-runs.service";
import { ProjectsModule } from "../../projects/projects.module";
import { UncertaintyController } from "./uncertainty.controller";
import { UncertaintyService } from "./uncertainty.service";

/** Shared backend infrastructure for the method editors belongs in this module. */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AnalysisRunRecord.name, schema: AnalysisRunRecordSchema },
      { name: SyWorkbook.name, schema: SyWorkbookSchema },
      { name: EsWorkbook.name, schema: EsWorkbookSchema },
      { name: EsqWorkbook.name, schema: EsqWorkbookSchema },
      { name: DaWorkbook.name, schema: DaWorkbookSchema },
      { name: HrWorkbook.name, schema: HrWorkbookSchema },
      { name: ScWorkbook.name, schema: ScWorkbookSchema },
    ]),
    WorkbooksModule,
    ProjectsModule,
  ],
  controllers: [UncertaintyController],
  providers: [
    PraetorAnalysisClient,
    WorkbookDependencyDiscoveryService,
    WorkbookAnalysisRunsService,
    UncertaintyService,
  ],
  exports: [
    MongooseModule,
    PraetorAnalysisClient,
    WorkbookDependencyDiscoveryService,
    WorkbookAnalysisRunsService,
    UncertaintyService,
  ],
})
export class NewlyDevelopedMethodsSharedModule {}

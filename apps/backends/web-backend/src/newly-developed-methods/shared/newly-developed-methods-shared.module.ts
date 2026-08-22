import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AnalysisRunRecord, AnalysisRunRecordSchema } from "./analysis-run-record.schema";
import { PraetorAnalysisClient } from "./praetor-analysis.client";
import { WorkbooksModule } from "../../workbooks/workbooks.module";
import { SyWorkbook, SyWorkbookSchema } from "../../sy-workbooks/sy-workbook.schema";
import { EsWorkbook, EsWorkbookSchema } from "../../es-workbooks/es-workbook.schema";
import { EsqWorkbook, EsqWorkbookSchema } from "../../esq-workbooks/esq-workbook.schema";
import { WorkbookDependencyDiscoveryService } from "./workbook-dependency-discovery.service";
import { WorkbookAnalysisRunsService } from "./workbook-analysis-runs.service";
import { ProjectsModule } from "../../projects/projects.module";

/** Shared backend infrastructure for the method editors belongs in this module. */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AnalysisRunRecord.name, schema: AnalysisRunRecordSchema },
      { name: SyWorkbook.name, schema: SyWorkbookSchema },
      { name: EsWorkbook.name, schema: EsWorkbookSchema },
      { name: EsqWorkbook.name, schema: EsqWorkbookSchema },
    ]),
    WorkbooksModule,
    ProjectsModule,
  ],
  providers: [
    PraetorAnalysisClient,
    WorkbookDependencyDiscoveryService,
    WorkbookAnalysisRunsService,
  ],
  exports: [
    MongooseModule,
    PraetorAnalysisClient,
    WorkbookDependencyDiscoveryService,
    WorkbookAnalysisRunsService,
  ],
})
export class NewlyDevelopedMethodsSharedModule {}

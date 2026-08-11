import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ExampleWorkbooksModule } from "../example-workbooks/example-workbooks.module";
import { ProjectsModule } from "../projects/projects.module";
import { WorkbooksModule } from "../workbooks/workbooks.module";
import { HazardsScreeningAnalysisMefAdapter } from "./hazards-screening-analysis-mef-adapter";
import { HazardsScreeningAnalysisWorkbook, HazardsScreeningAnalysisWorkbookSchema } from "./hazards-screening-analysis-workbook.schema";
import { HazardsScreeningAnalysisWorkbooksController } from "./hazards-screening-analysis-workbooks.controller";
import { HazardsScreeningAnalysisWorkbooksService } from "./hazards-screening-analysis-workbooks.service";

@Module({
  imports: [MongooseModule.forFeature([{ name: HazardsScreeningAnalysisWorkbook.name, schema: HazardsScreeningAnalysisWorkbookSchema }]), ProjectsModule, ExampleWorkbooksModule, WorkbooksModule],
  controllers: [HazardsScreeningAnalysisWorkbooksController], providers: [HazardsScreeningAnalysisWorkbooksService, HazardsScreeningAnalysisMefAdapter], exports: [HazardsScreeningAnalysisWorkbooksService],
})
export class HazardsScreeningAnalysisWorkbooksModule {}

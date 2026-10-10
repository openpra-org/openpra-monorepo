import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "../users/user.schema";
import { Team, TeamSchema } from "../teams/team.schema";
import { ProjectsModule } from "../projects/projects.module";
import { Workbook, WorkbookSchema } from "./workbook.schema";
import { WorkbookRole, WorkbookRoleSchema } from "./workbook-role.schema";
import { WorkbookSignoff, WorkbookSignoffSchema } from "./workbook-signoff.schema";
import { WorkbooksController } from "./workbooks.controller";
import { WorkbooksService } from "./workbooks.service";
import { WorkbookReviewController } from "./workbook-review.controller";
import { WorkbookRolesService } from "./workbook-roles.service";
import { WorkbookWorkflowService } from "./workbook-workflow.service";
import { WorkbookCommentsService } from "./workbook-comments.service";
import { WorkbookElementRegistry } from "./workbook-element-registry";
import { WorkbookModelAccessService } from "./workbook-model-access.service";
import { UncertaintyMigrationService } from "./uncertainty-migration.service";
import { SyWorkbook, SyWorkbookSchema } from "../sy-workbooks/sy-workbook.schema";
import { DaWorkbook, DaWorkbookSchema } from "../da-workbooks/da-workbook.schema";
import { EsqWorkbook, EsqWorkbookSchema } from "../esq-workbooks/esq-workbook.schema";
import { HrWorkbook, HrWorkbookSchema } from "../hr-workbooks/hr-workbook.schema";
import { IeWorkbook, IeWorkbookSchema } from "../ie-workbooks/ie-workbook.schema";
import { EsWorkbook, EsWorkbookSchema } from "../es-workbooks/es-workbook.schema";
import { SeismicPraWorkbook, SeismicPraWorkbookSchema } from "../seismic-pra-workbooks/seismic-pra-workbook.schema";
import { InternalFirePraWorkbook, InternalFirePraWorkbookSchema } from "../internal-fire-pra-workbooks/internal-fire-pra-workbook.schema";
import { InternalFloodPraWorkbook, InternalFloodPraWorkbookSchema } from "../internal-flood-pra-workbooks/internal-flood-pra-workbook.schema";
import { HighWindsPraWorkbook, HighWindsPraWorkbookSchema } from "../high-winds-pra-workbooks/high-winds-pra-workbook.schema";
import { ExternalFloodPraWorkbook, ExternalFloodPraWorkbookSchema } from "../external-flood-pra-workbooks/external-flood-pra-workbook.schema";
import { OtherHazardsPraWorkbook, OtherHazardsPraWorkbookSchema } from "../other-hazards-pra-workbooks/other-hazards-pra-workbook.schema";
import { AnalysisRunRecord, AnalysisRunRecordSchema } from "../newly-developed-methods/shared/analysis-run-record.schema";
import { PraetorAnalysisClient } from "../newly-developed-methods/shared/praetor-analysis.client";
import { UncertaintyService } from "../newly-developed-methods/shared/uncertainty.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Workbook.name, schema: WorkbookSchema },
      { name: WorkbookRole.name, schema: WorkbookRoleSchema },
      { name: WorkbookSignoff.name, schema: WorkbookSignoffSchema },
      { name: User.name, schema: UserSchema },
      { name: Team.name, schema: TeamSchema },
      { name: SyWorkbook.name, schema: SyWorkbookSchema },
      { name: DaWorkbook.name, schema: DaWorkbookSchema },
      { name: EsqWorkbook.name, schema: EsqWorkbookSchema },
      { name: HrWorkbook.name, schema: HrWorkbookSchema },
      { name: IeWorkbook.name, schema: IeWorkbookSchema },
      { name: EsWorkbook.name, schema: EsWorkbookSchema },
      { name: SeismicPraWorkbook.name, schema: SeismicPraWorkbookSchema },
      { name: InternalFirePraWorkbook.name, schema: InternalFirePraWorkbookSchema },
      { name: InternalFloodPraWorkbook.name, schema: InternalFloodPraWorkbookSchema },
      { name: HighWindsPraWorkbook.name, schema: HighWindsPraWorkbookSchema },
      { name: ExternalFloodPraWorkbook.name, schema: ExternalFloodPraWorkbookSchema },
      { name: OtherHazardsPraWorkbook.name, schema: OtherHazardsPraWorkbookSchema },
      { name: AnalysisRunRecord.name, schema: AnalysisRunRecordSchema },
    ]),
    ProjectsModule,
  ],
  controllers: [WorkbooksController, WorkbookReviewController],
  providers: [
    WorkbooksService,
    WorkbookRolesService,
    WorkbookWorkflowService,
    WorkbookCommentsService,
    WorkbookElementRegistry,
    WorkbookModelAccessService,
    PraetorAnalysisClient,
    UncertaintyService,
    UncertaintyMigrationService,
  ],
  exports: [
    MongooseModule,
    WorkbookRolesService,
    WorkbookElementRegistry,
    WorkbookModelAccessService,
  ],
})
export class WorkbooksModule {}

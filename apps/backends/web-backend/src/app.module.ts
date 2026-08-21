import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "./auth/auth.module";
import { OrgsModule } from "./orgs/orgs.module";
import { ProjectsModule } from "./projects/projects.module";
import { WorkbooksModule } from "./workbooks/workbooks.module";
import { TeamsModule } from "./teams/teams.module";
import { UsersModule } from "./users/users.module";
import { EventsModule } from "./events/events.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { AuditModule } from "./audit/audit.module";
import { SessionsModule } from "./sessions/sessions.module";
import { ExampleWorkbooksModule } from "./example-workbooks/example-workbooks.module";
import { PosWorkbooksModule } from "./pos-workbooks/pos-workbooks.module";
import { IeWorkbooksModule } from "./ie-workbooks/ie-workbooks.module";
import { EsWorkbooksModule } from "./es-workbooks/es-workbooks.module";
import { ScWorkbooksModule } from "./sc-workbooks/sc-workbooks.module";
import { SyWorkbooksModule } from "./sy-workbooks/sy-workbooks.module";
import { HrWorkbooksModule } from "./hr-workbooks/hr-workbooks.module";
import { DaWorkbooksModule } from "./da-workbooks/da-workbooks.module";
import { EsqWorkbooksModule } from "./esq-workbooks/esq-workbooks.module";
import { MsWorkbooksModule } from "./ms-workbooks/ms-workbooks.module";
import { RcWorkbooksModule } from "./rc-workbooks/rc-workbooks.module";
import { RiWorkbooksModule } from "./ri-workbooks/ri-workbooks.module";
import { SeismicPraWorkbooksModule } from "./seismic-pra-workbooks/seismic-pra-workbooks.module";
import { InternalFloodPraWorkbooksModule } from "./internal-flood-pra-workbooks/internal-flood-pra-workbooks.module";
import { InternalFirePraWorkbooksModule } from "./internal-fire-pra-workbooks/internal-fire-pra-workbooks.module";
import { HazardsScreeningAnalysisWorkbooksModule } from "./hazards-screening-analysis-workbooks/hazards-screening-analysis-workbooks.module";
import { HighWindsPraWorkbooksModule } from "./high-winds-pra-workbooks/high-winds-pra-workbooks.module";
import { ExternalFloodPraWorkbooksModule } from "./external-flood-pra-workbooks/external-flood-pra-workbooks.module";
import { OtherHazardsPraWorkbooksModule } from "./other-hazards-pra-workbooks/other-hazards-pra-workbooks.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { NewlyDevelopedMethodsModule } from "./newly-developed-methods/newly-developed-methods.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: "apps/backends/web-backend/.env" }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env["MONGO_URI"] ?? "mongodb://127.0.0.1:27017/openpra",
      }),
    }),
    EventsModule,
    SessionsModule,
    AnalyticsModule,
    AuthModule,
    UsersModule,
    OrgsModule,
    ProjectsModule,
    WorkbooksModule,
    TeamsModule,
    NotificationsModule,
    AuditModule,
    ExampleWorkbooksModule,
    PosWorkbooksModule,
    IeWorkbooksModule,
    EsWorkbooksModule,
    ScWorkbooksModule,
    SyWorkbooksModule,
    HrWorkbooksModule,
    DaWorkbooksModule,
    EsqWorkbooksModule,
    MsWorkbooksModule,
    RcWorkbooksModule,
    RiWorkbooksModule,
    SeismicPraWorkbooksModule,
    InternalFloodPraWorkbooksModule,
    InternalFirePraWorkbooksModule,
    HazardsScreeningAnalysisWorkbooksModule,
    HighWindsPraWorkbooksModule,
    ExternalFloodPraWorkbooksModule,
    OtherHazardsPraWorkbooksModule,
    NewlyDevelopedMethodsModule,
  ],
})
export class AppModule {}

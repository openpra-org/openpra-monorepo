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
  ],
})
export class AppModule {}

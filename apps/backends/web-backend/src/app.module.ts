import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "./auth/auth.module";
import { OrgsModule } from "./orgs/orgs.module";
import { ProjectsModule } from "./projects/projects.module";
import { TeamsModule } from "./teams/teams.module";
import { UsersModule } from "./users/users.module";
import { EventsModule } from "./events/events.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { AuditModule } from "./audit/audit.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: "apps/backends/web-backend/.env" }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env["MONGO_URI"] ?? "mongodb://127.0.0.1:27017/openpra",
      }),
    }),
    EventsModule,
    AuthModule,
    UsersModule,
    OrgsModule,
    ProjectsModule,
    TeamsModule,
    NotificationsModule,
    AuditModule,
  ],
})
export class AppModule {}

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "./auth/auth.module";
import { OrgsModule } from "./orgs/orgs.module";
import { ProjectsModule } from "./projects/projects.module";
import { TeamsModule } from "./teams/teams.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: "apps/backends/web-backend/.env" }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env["MONGO_URI"] ?? "mongodb://127.0.0.1:27017/openpra",
      }),
    }),
    AuthModule,
    UsersModule,
    OrgsModule,
    ProjectsModule,
    TeamsModule,
  ],
})
export class AppModule {}

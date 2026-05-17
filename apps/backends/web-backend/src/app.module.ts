import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "./auth/auth.module";
import { ProjectModule } from "./project/project.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: "apps/backends/web-backend/.env" }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env["MONGO_URI"] ?? "mongodb://127.0.0.1:27017/openpra",
      }),
    }),
    AuthModule,
    ProjectModule,
  ],
})
export class AppModule {}

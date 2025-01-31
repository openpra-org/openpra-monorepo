import * as fs from "fs";
import * as process from "process";
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MailerModule } from "@nestjs-modules/mailer";
import { HandlebarsAdapter } from "@nestjs-modules/mailer/dist/adapters/handlebars.adapter";
import { CollabModule } from "../collab/collab.module";
import { LocalAuthGuard } from "../guards/local-auth.guard";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { LocalStrategy } from "./strategies/local.strategy";
import { JwtStrategy } from "./strategies/jwt.strategy";

@Module({
  imports: [
    CollabModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        secret: process.env.DEPLOYMENT
          ? fs.readFileSync(config.get<string>("JWT_SECRET_KEY"))
          : config.get<string>("JWT_SECRET_KEY"),
        signOptions: { expiresIn: "24h" },
      }),
    }),
    MailerModule.forRootAsync({
      useFactory: () => ({
        transport: {
          // host: process.env.MAIL_HOST,
          // port: parseInt(process.env.MAIL_PORT, 10),
          // auth: {
          //   user: process.env.MAIL_USER,
          //   pass: process.env.MAIL_PASSWORD,
          // },
          service: "Gmail",
          host: "smtp.gmail.com",
          port: 465,
          secure: true,
          auth: {
            user: "jinishshah08@gmail.com",
            pass: "lvya ligs hgsg spns",
          },
        },
        // defaults: {
        //   from: '"No Reply" <noreply@example.com>',
        // },
        // template: {
        //   dir: process.cwd() + "/templates/",
        //   adapter: new HandlebarsAdapter(),
        //   options: {
        //     strict: true,
        //   },
        // },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy, LocalAuthGuard],
})
export class AuthModule {}

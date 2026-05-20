import { Module } from "@nestjs/common";
import { JwtModule, type JwtSignOptions } from "@nestjs/jwt";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { EmailService } from "./email.service";
import { TwoFactorService } from "./twoFactor.service";
import { User, UserSchema } from "../users/user.schema";
import { OrgsModule } from "../orgs/orgs.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({
        secret: process.env["JWT_SECRET"] ?? "dev-secret-do-not-use-in-production",
        signOptions: { expiresIn: (process.env["JWT_EXPIRES_IN"] ?? "7d") as JwtSignOptions["expiresIn"] },
      }),
    }),
    OrgsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, EmailService, TwoFactorService],
  exports: [TwoFactorService],
})
export class AuthModule {}

import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { JwtModule } from "@nestjs/jwt";
import { UsersModule } from "../users/users.module";
import { AuthGqlService } from "./auth-gql.service";
import { AuthGqlResolver } from "./auth-gql.resolver";
import { LocalStrategy } from "./local.strategy";
import { JwtStrategy } from "./jwt.strategy";

@Module({
  imports: [
    PassportModule,
    UsersModule,
    JwtModule.register({
      signOptions: { expiresIn: "10m" },
      secret: "temp",
    }),
  ],
  providers: [AuthGqlService, AuthGqlResolver, LocalStrategy, JwtStrategy],
})
export class AuthGqlModule {}

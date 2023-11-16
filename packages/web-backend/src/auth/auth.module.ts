import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CollabModule } from '../collab/collab.module';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ConfigModule, ConfigService } from "@nestjs/config";
import * as fs from "fs";
import * as process from "process";

@Module({
  imports: [
    CollabModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        secret: process.env.DEPLOYMENT ? fs.readFileSync(config.get<string>('JWT_SECRET_KEY')) : config.get<string>('JWT_SECRET_KEY'),
        signOptions: { expiresIn: '24h' }
      })
    })
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy]
})

export class AuthModule {}


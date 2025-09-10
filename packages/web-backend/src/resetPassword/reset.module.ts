import { Module } from "@nestjs/common";
import { CollabModule } from "../collab/collab.module";
import { ResetPasswordService } from './reset.service';
import { MailService } from '../mail/mail.service';
import { ResetController } from './reset.controller'
import { ResetTokenService } from "./reset-token.service";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from '@nestjs/mongoose';
import { ResetToken, ResetTokenSchema } from './schemas/reset-token.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ResetToken.name, schema: ResetTokenSchema }
    ]),
    CollabModule],
  controllers: [ResetController],
  providers: [ResetPasswordService, MailService, ResetTokenService, ConfigModule],
})
export class ResetModule {}

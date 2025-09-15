import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { PasswordReset, PasswordResetSchema } from "./Schema/passwordreset.schema";
import { PasswordResetController } from "./passwordreset.controller";
import { PasswordResetService } from "./passwordreset.service";
import { CollabModule } from "../collab/collab.module";
import { MailerService } from "./mailer.service";
@Module({
    imports: [MongooseModule.forFeature([
        {
            name: PasswordReset.name,
            schema: PasswordResetSchema 
        }
    ]), CollabModule],
    controllers: [PasswordResetController],
    providers: [PasswordResetService, MailerService],
})
export class PasswordResetModule{}
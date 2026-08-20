import { Global, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Session, SessionSchema } from "./session.schema";
import { SessionsService } from "./sessions.service";

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: Session.name, schema: SessionSchema }])],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}

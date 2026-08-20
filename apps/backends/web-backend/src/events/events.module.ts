import { Global, Module } from "@nestjs/common";
import { EventBus } from "./event-bus";

@Global()
@Module({
  providers: [EventBus],
  exports: [EventBus],
})
export class EventsModule {}

import { Injectable, Logger } from "@nestjs/common";
import type { DomainEvent } from "./domain-events";

type Handler = (event: DomainEvent) => Promise<void> | void;

@Injectable()
export class EventBus {
  private readonly logger = new Logger(EventBus.name);
  private readonly handlers: Handler[] = [];

  subscribe(handler: Handler): void {
    this.handlers.push(handler);
  }

  async emit(event: DomainEvent): Promise<void> {
    for (const handler of this.handlers) {
      try {
        await handler(event);
      } catch (err) {
        this.logger.error(`Handler failed for event "${event.type}"`, err as Error);
      }
    }
  }
}

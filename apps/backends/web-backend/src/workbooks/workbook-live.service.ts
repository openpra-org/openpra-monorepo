import { Injectable, type MessageEvent, type OnModuleDestroy } from "@nestjs/common";
import { Observable, Subject, filter, interval, map, merge } from "rxjs";
import type { WorkbookLiveEvent } from "interfaces-shared-types/workbooks";

const HEARTBEAT_MS = 25_000;

@Injectable()
export class WorkbookLiveService implements OnModuleDestroy {
  private readonly events = new Subject<WorkbookLiveEvent>();

  publish(event: WorkbookLiveEvent): void {
    this.events.next(event);
  }

  stream(workbookId: string): Observable<MessageEvent> {
    return merge(
      this.events.pipe(
        filter((event) => event.workbookId === workbookId),
        map((event): MessageEvent => ({ type: "change", data: event })),
      ),
      interval(HEARTBEAT_MS).pipe(map((): MessageEvent => ({ type: "ping", data: "" }))),
    );
  }

  onModuleDestroy(): void {
    this.events.complete();
  }
}

import { AsyncLocalStorage } from "node:async_hooks";
import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Observable } from "rxjs";

export const analysisRequestSignal = new AsyncLocalStorage<AbortSignal>();

/** Keep cancellation scoped to this HTTP request, including concurrent runs. */
@Injectable()
export class AnalysisCancellationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return new Observable((subscriber) => {
      const request = context.switchToHttp().getRequest<IncomingMessage>();
      const response = context.switchToHttp().getResponse<ServerResponse>();
      const controller = new AbortController();
      const cancel = (): void => {
        if (!response.writableEnded) controller.abort();
      };
      request.once("aborted", cancel);
      response.once("close", cancel);
      if (request.aborted || response.destroyed) cancel();
      const subscription = analysisRequestSignal.run(controller.signal, () => next.handle().subscribe(subscriber));
      return () => {
        request.removeListener("aborted", cancel);
        response.removeListener("close", cancel);
        subscription.unsubscribe();
      };
    });
  }
}

import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from "@nestjs/common";
import type { Request, Response } from "express";
import { Observable, from, mergeMap, switchMap, tap } from "rxjs";
import { z } from "zod";
import {
  WORKBOOK_CLIENT_HEADER,
  WORKBOOK_ID_HEADER,
  WORKBOOK_SEEN_HEADER,
  WORKBOOK_SEQ_HEADER,
  WorkbookPatchOperationSchema,
} from "interfaces-shared-types/workbooks";
import { WorkbookChangesService, type WorkbookChangePath } from "./workbook-changes.service";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const UNRECORDED_SEGMENTS = new Set(["live", "validate"]);
const ANNOUNCED_SEGMENTS = new Set(["collaborators"]);

const MefPatchBodySchema = z.object({ operations: z.array(WorkbookPatchOperationSchema).min(1) });

interface WorkbookChangeRequest extends Request {
  user?: { username: string };
}

function routeSegments(request: WorkbookChangeRequest): string[] {
  const route: { path?: string } | undefined = request.route;
  return (route?.path ?? "").split("/");
}

function routeWorkbookId(request: WorkbookChangeRequest): string | null {
  const id = request.params["id"];
  if (id === undefined || id.length === 0) return null;
  const segments = routeSegments(request);
  const index = segments.indexOf(":id");
  if (index < 1) return null;
  const before = segments[index - 1] ?? "";
  const workbookRoute = before === "workbooks" || (before.endsWith("-workbooks") && before !== "example-workbooks");
  return workbookRoute ? id : null;
}

function headerText(request: WorkbookChangeRequest, name: string): string | null {
  const value = request.headers[name];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function seenSeq(request: WorkbookChangeRequest): number | null {
  const text = headerText(request, WORKBOOK_SEEN_HEADER);
  if (text === null) return null;
  const value = Number(text);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function mefPatchPaths(request: WorkbookChangeRequest): WorkbookChangePath[] | null {
  const parsed = MefPatchBodySchema.safeParse(request.body);
  if (!parsed.success) return null;
  return parsed.data.operations.map((operation) => {
    const last = operation.path[operation.path.length - 1];
    return operation.op !== "replace" && typeof last === "number" ? operation.path.slice(0, -1) : [...operation.path];
  });
}

function setExpectedRevision(request: WorkbookChangeRequest, revision: number): void {
  const body: object | null = typeof request.body === "object" ? request.body : null;
  if (body !== null && "expectedRevision" in body) Object.assign(body, { expectedRevision: revision });
}

@Injectable()
export class WorkbookChangesInterceptor<T> implements NestInterceptor<T, T> {
  constructor(private readonly changes: WorkbookChangesService) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<T> {
    if (context.getType() !== "http") return next.handle();
    const http = context.switchToHttp();
    const request = http.getRequest<WorkbookChangeRequest>();
    const workbookId = routeWorkbookId(request);
    if (workbookId === null) return next.handle();
    const segments = routeSegments(request);
    if (segments.some((segment) => UNRECORDED_SEGMENTS.has(segment))) return next.handle();
    if (segments.some((segment) => ANNOUNCED_SEGMENTS.has(segment))) {
      if (!MUTATING_METHODS.has(request.method)) return next.handle();
      const announcer = request.user?.username ?? "";
      const announcerClient = headerText(request, WORKBOOK_CLIENT_HEADER);
      return next.handle().pipe(
        mergeMap(async (result) => {
          await this.changes.announce(workbookId, announcer, announcerClient);
          return result;
        }),
      );
    }
    if (request.method === "GET") {
      const response = http.getResponse<Response>();
      return from(this.changes.currentSeq(workbookId)).pipe(
        tap((seq) => {
          if (seq === null || response.headersSent) return;
          response.setHeader(WORKBOOK_ID_HEADER, workbookId);
          response.setHeader(WORKBOOK_SEQ_HEADER, String(seq));
        }),
        switchMap(() => next.handle()),
      );
    }
    if (!MUTATING_METHODS.has(request.method)) return next.handle();
    const paths = mefPatchPaths(request);
    const clientId = headerText(request, WORKBOOK_CLIENT_HEADER);
    const actor = request.user?.username ?? "";
    return from(this.changes.admit(workbookId, paths, seenSeq(request), clientId)).pipe(
      tap((revision) => {
        if (revision !== null) setExpectedRevision(request, revision);
      }),
      switchMap(() => next.handle()),
      mergeMap(async (result) => {
        await this.changes.record(workbookId, paths ?? [[]], actor, clientId);
        return result;
      }),
    );
  }
}

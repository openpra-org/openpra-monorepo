import { Injectable } from "@nestjs/common";

export interface WorkbookExampleVariant {
  exampleId: string;
  label: string;
  workbookName: string;
}

export interface WorkbookElementAdapter {
  readonly elementCode: string;
  createBlank(workbookId: string, projectId: string, name: string, ownerUsername: string): Promise<void>;
  load(workbookId: string): Promise<{ projectId: string; ownerUsername: string; mef: unknown } | null>;
  save(workbookId: string, mef: unknown): Promise<unknown>;
  exampleVariants?(): WorkbookExampleVariant[];
  loadExample?(workbookId: string, acting: { username: string }, exampleId: string): Promise<void>;
}

@Injectable()
export class WorkbookElementRegistry {
  private readonly adapters = new Map<string, WorkbookElementAdapter>();

  register(adapter: WorkbookElementAdapter): void {
    this.adapters.set(adapter.elementCode, adapter);
  }

  tryGet(elementCode: string): WorkbookElementAdapter | undefined {
    return this.adapters.get(elementCode);
  }

  list(): WorkbookElementAdapter[] {
    return Array.from(this.adapters.values());
  }

  get(elementCode: string): WorkbookElementAdapter {
    const adapter = this.adapters.get(elementCode);
    if (adapter === undefined) throw new Error(`No workbook adapter registered for element ${elementCode}`);
    return adapter;
  }
}

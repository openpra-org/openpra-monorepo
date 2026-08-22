import { BadRequestException, ConflictException } from "@nestjs/common";
import { createBlankEs } from "../../es-workbooks/blank-es";
import { EsMefAdapter } from "../../es-workbooks/es-mef-adapter";
import { createBlankEsq } from "../../esq-workbooks/blank-esq";
import { EsqMefAdapter } from "../../esq-workbooks/esq-mef-adapter";
import { createBlankSy } from "../../sy-workbooks/blank-sy";
import { SyMefAdapter } from "../../sy-workbooks/sy-mef-adapter";
import { WorkbookCommentsService } from "../workbook-comments.service";
import {
  WorkbookElementRegistry,
  type WorkbookElementAdapter,
} from "../workbook-element-registry";
import { WorkbookWorkflowService } from "../workbook-workflow.service";

interface MockContentDocument {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  revision?: number;
  mef: unknown;
}

interface MockContentModel {
  findOne: jest.Mock;
  findOneAndUpdate: jest.Mock;
}

interface RevisionFilter {
  workbookId: string;
  revision?: number;
  $or?: Array<{ revision: number } | { revision: { $exists: false } }>;
}

interface AdapterCase {
  name: string;
  createMef: () => unknown;
  createAdapter: (model: MockContentModel) => Pick<WorkbookElementAdapter, "load" | "save">;
}

const query = <T>(value: T): { exec: jest.Mock } => ({
  exec: jest.fn().mockResolvedValue(value),
});

const matchesRevision = (document: MockContentDocument, filter: RevisionFilter): boolean => {
  if (filter.revision !== undefined) return document.revision === filter.revision;
  return (
    filter.$or?.some((condition) => {
      if (typeof condition.revision === "number") return document.revision === condition.revision;
      return condition.revision.$exists === false && document.revision === undefined;
    }) ?? false
  );
};

const createModel = (document: MockContentDocument): MockContentModel => ({
  findOne: jest.fn().mockImplementation(({ workbookId }: { workbookId: string }) =>
    query(workbookId === document.workbookId ? document : null),
  ),
  findOneAndUpdate: jest.fn().mockImplementation(
    (
      filter: RevisionFilter,
      update: { $set: { mef: unknown; revision: number } },
    ) =>
      query(
        filter.workbookId === document.workbookId && matchesRevision(document, filter)
          ? Object.assign(document, update.$set)
          : null,
      ),
  ),
});

const adapterCases: AdapterCase[] = [
  {
    name: "SY",
    createMef: () => createBlankSy("SY revision", "analyst"),
    createAdapter: (model) =>
      new SyMefAdapter(model as never, new WorkbookElementRegistry(), {} as never),
  },
  {
    name: "ES",
    createMef: () => createBlankEs("ES revision", "analyst"),
    createAdapter: (model) =>
      new EsMefAdapter(model as never, new WorkbookElementRegistry(), {} as never),
  },
  {
    name: "ESQ",
    createMef: () => createBlankEsq("ESQ revision", "analyst"),
    createAdapter: (model) =>
      new EsqMefAdapter(model as never, new WorkbookElementRegistry(), {} as never),
  },
];

describe.each(adapterCases)("$name MEF adapter revision persistence", ({ createMef, createAdapter }) => {
  it("loads the revision and atomically advances it on save", async () => {
    const document: MockContentDocument = {
      workbookId: "workbook-1",
      projectId: "project-1",
      ownerUsername: "analyst",
      revision: 4,
      mef: createMef(),
    };
    const model = createModel(document);
    const adapter = createAdapter(model);
    const loaded = await adapter.load(document.workbookId);
    const nextMef = structuredClone(loaded!.mef) as { name: string };
    nextMef.name = "Revision-aware update";

    await adapter.save(document.workbookId, nextMef, loaded!.revision);

    expect(document.revision).toBe(5);
    expect((document.mef as { name: string }).name).toBe("Revision-aware update");
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { workbookId: document.workbookId, revision: 4 },
      expect.objectContaining({ $set: expect.objectContaining({ revision: 5 }) }),
      { new: true, runValidators: true },
    );
  });

  it("rejects a stale snapshot before it can overwrite newer MEF content", async () => {
    const document: MockContentDocument = {
      workbookId: "workbook-1",
      projectId: "project-1",
      ownerUsername: "analyst",
      revision: 1,
      mef: createMef(),
    };
    const model = createModel(document);
    const adapter = createAdapter(model);
    const stale = await adapter.load(document.workbookId);
    const newerMef = structuredClone(document.mef) as { name: string };
    newerMef.name = "Concurrent winner";
    document.mef = newerMef;
    document.revision = 2;

    await expect(adapter.save(document.workbookId, stale!.mef, stale!.revision)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(document.revision).toBe(2);
    expect((document.mef as { name: string }).name).toBe("Concurrent winner");
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("requires callers to supply the revision of the MEF snapshot being saved", async () => {
    const document: MockContentDocument = {
      workbookId: "workbook-1",
      projectId: "project-1",
      ownerUsername: "analyst",
      revision: 1,
      mef: createMef(),
    };
    const model = createModel(document);
    const adapter = createAdapter(model);

    await expect(adapter.save(document.workbookId, document.mef)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe("generic workbook mutation revision plumbing", () => {
  const workbookId = "507f1f77bcf86cd799439011";

  it("passes the loaded revision through review-comment saves", async () => {
    const adapter = {
      load: jest.fn().mockResolvedValue({
        projectId: "project-1",
        ownerUsername: "analyst",
        revision: 7,
        mef: {
          internalReviewComments: { comments: [], openCount: 0, resolvedCount: 0 },
        },
      }),
      save: jest.fn().mockResolvedValue({}),
    };
    const registry = { get: jest.fn().mockReturnValue(adapter) };
    const service = new WorkbookCommentsService(
      { findById: jest.fn().mockReturnValue(query({ id: workbookId, projectId: "project-1", elementCode: "SY" })) } as never,
      { resolveAccess: jest.fn().mockResolvedValue({ role: "member" }) } as never,
      { resolveEffectiveRoles: jest.fn().mockResolvedValue(["reviewer"]) } as never,
      registry as never,
    );

    await service.addComment(workbookId, { text: "Check this model" }, { username: "reviewer" });

    expect(adapter.save).toHaveBeenCalledWith(workbookId, expect.any(Object), 7);
  });

  it("passes the loaded revision through workflow-transition saves", async () => {
    const adapter = {
      load: jest.fn().mockResolvedValue({
        projectId: "project-1",
        ownerUsername: "analyst",
        revision: 9,
        mef: { workflowState: "DRAFT", workflowHistory: [] },
      }),
      save: jest.fn().mockResolvedValue({}),
    };
    const registry = { get: jest.fn().mockReturnValue(adapter) };
    const service = new WorkbookWorkflowService(
      { findById: jest.fn().mockReturnValue(query({ id: workbookId, projectId: "project-1", elementCode: "SY" })) } as never,
      {
        deleteMany: jest.fn().mockReturnValue(query(undefined)),
      } as never,
      { resolveAccess: jest.fn().mockResolvedValue({ role: "member" }) } as never,
      {
        resolveEffectiveRoles: jest.fn().mockResolvedValue(["preparer"]),
        assignedUsernamesFor: jest.fn().mockResolvedValue(["reviewer"]),
      } as never,
      registry as never,
    );

    await service.submitForReview(workbookId, { username: "analyst" });

    expect(adapter.save).toHaveBeenCalledWith(workbookId, expect.any(Object), 9);
  });

  it.each(["approver", "preparer"] as const)(
    "retries an existing %s signoff idempotently and completes the final transition",
    async (role) => {
      const adapter = {
        load: jest.fn().mockResolvedValue({
          projectId: "project-1",
          ownerUsername: "analyst",
          revision: 11,
          mef: {
            workflowState: "INTERNAL_APPROVAL",
            workflowHistory: [
              {
                state: "INTERNAL_APPROVAL",
                enteredAt: "2026-08-22T12:00:00.000Z",
                actor: "analyst",
              },
            ],
            internalReviewComments: { comments: [] },
          },
        }),
        save: jest.fn().mockResolvedValue({}),
      };
      const registry = { get: jest.fn().mockReturnValue(adapter) };
      const existingSignoff = { workbookId, username: "analyst", role };
      const signoffs = {
        findOne: jest.fn().mockReturnValue(query(existingSignoff)),
        find: jest.fn().mockReturnValue(query([existingSignoff])),
        create: jest.fn(),
      };
      const roles = {
        resolveEffectiveRoles: jest.fn().mockResolvedValue([role]),
        assignedUsernamesFor: jest
          .fn()
          .mockImplementation((_workbookId: string, requestedRole: string) =>
            Promise.resolve(requestedRole === role ? ["analyst"] : []),
          ),
      };
      const service = new WorkbookWorkflowService(
        { findById: jest.fn().mockReturnValue(query({ id: workbookId, projectId: "project-1", elementCode: "SY" })) } as never,
        signoffs as never,
        { resolveAccess: jest.fn().mockResolvedValue({ role: "member" }) } as never,
        roles as never,
        registry as never,
      );

      if (role === "approver") {
        await service.signApproval(workbookId, { username: "analyst" });
      } else {
        await service.signAs(workbookId, "preparer", { username: "analyst" });
      }

      expect(signoffs.create).not.toHaveBeenCalled();
      expect(adapter.save).toHaveBeenCalledWith(
        workbookId,
        expect.objectContaining({ workflowState: "FINAL" }),
        11,
      );
    },
  );
});

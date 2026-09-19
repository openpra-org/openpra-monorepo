import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { ProjectsService } from "../../projects/projects.service";
import { WorkbookModelAccessService } from "../workbook-model-access.service";
import type { WorkbookRoleName, WorkbookRolesService } from "../workbook-roles.service";

type Operation = "edit" | "execute";

const ALLOWED_CASES = (["owner", "editor"] as const).flatMap((projectRole) =>
  (["preparer", "co_preparer"] as const).flatMap((workbookRole) =>
    (["DRAFT", "REVISION_REQUIRED"] as const).flatMap((workflowState) =>
      (["edit", "execute"] as const).map((operation) => ({
        projectRole,
        workbookRole,
        workflowState,
        operation,
      })),
    ),
  ),
);

describe("WorkbookModelAccessService", () => {
  let projectsService: { resolveAccess: jest.Mock };
  let rolesService: { resolveEffectiveRoles: jest.Mock };
  let service: WorkbookModelAccessService;

  beforeEach(() => {
    projectsService = { resolveAccess: jest.fn() };
    rolesService = { resolveEffectiveRoles: jest.fn() };
    service = new WorkbookModelAccessService(
      projectsService as unknown as ProjectsService,
      rolesService as unknown as WorkbookRolesService,
    );
  });

  function authorize(operation: Operation, workflowState?: string) {
    const input = {
      workbookId: "workbook-1",
      projectId: "project-1",
      mef: workflowState === undefined ? {} : { workflowState },
      acting: { username: "analyst" },
    };
    return operation === "edit" ? service.requireEdit(input) : service.requireExecution(input);
  }

  it.each(ALLOWED_CASES)(
    "allows $projectRole project access plus $workbookRole role to $operation in $workflowState",
    async ({ projectRole, workbookRole, workflowState, operation }) => {
      projectsService.resolveAccess.mockResolvedValue({ role: projectRole });
      rolesService.resolveEffectiveRoles.mockResolvedValue([workbookRole]);

      await expect(authorize(operation, workflowState)).resolves.toEqual({
        projectRole,
        workbookRoles: [workbookRole],
        workflowState,
      });
    },
  );

  it.each(["edit", "execute"] as const)(
    "blocks project viewers before workbook-role lookup for %s",
    async (operation) => {
      projectsService.resolveAccess.mockResolvedValue({ role: "viewer" });
      rolesService.resolveEffectiveRoles.mockResolvedValue(["preparer"]);

      await expect(authorize(operation, "DRAFT")).rejects.toThrow(ForbiddenException);
      expect(rolesService.resolveEffectiveRoles).not.toHaveBeenCalled();
    },
  );

  it.each(
    (["reviewer", "approver", undefined] as const).flatMap((workbookRole) =>
      (["edit", "execute"] as const).map((operation) => ({ workbookRole, operation })),
    ),
  )("blocks a non-author workbook role from $operation", async ({ workbookRole, operation }) => {
    projectsService.resolveAccess.mockResolvedValue({ role: "editor" });
    const workbookRoles: WorkbookRoleName[] = workbookRole === undefined ? [] : [workbookRole];
    rolesService.resolveEffectiveRoles.mockResolvedValue(workbookRoles);

    await expect(authorize(operation, "DRAFT")).rejects.toThrow(ForbiddenException);
  });

  it.each(
    (["INTERNAL_TECHNICAL_REVIEW", "INTERNAL_APPROVAL", "FINAL"] as const).flatMap(
      (workflowState) =>
        (["edit", "execute"] as const).map((operation) => ({ workflowState, operation })),
    ),
  )(
    "blocks $operation while the workbook is in $workflowState",
    async ({ workflowState, operation }) => {
      projectsService.resolveAccess.mockResolvedValue({ role: "owner" });
      rolesService.resolveEffectiveRoles.mockResolvedValue(["preparer"]);

      await expect(authorize(operation, workflowState)).rejects.toThrow(
        `while the workbook is in state ${workflowState}`,
      );
    },
  );

  it.each(["edit", "execute"] as const)(
    "defaults a legacy missing workflow state to DRAFT for %s",
    async (operation) => {
      projectsService.resolveAccess.mockResolvedValue({ role: "owner" });
      rolesService.resolveEffectiveRoles.mockResolvedValue(["preparer"]);

      await expect(authorize(operation)).resolves.toMatchObject({ workflowState: "DRAFT" });
    },
  );

  it.each(["edit", "execute"] as const)(
    "propagates concealed project-access failures before workbook lookup for %s",
    async (operation) => {
      projectsService.resolveAccess.mockRejectedValue(new NotFoundException("Project not found"));

      await expect(authorize(operation, "DRAFT")).rejects.toThrow(NotFoundException);
      expect(rolesService.resolveEffectiveRoles).not.toHaveBeenCalled();
    },
  );
});

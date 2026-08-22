import { ForbiddenException, Injectable } from "@nestjs/common";
import type { ProjectAccessRole } from "interfaces-shared-types";
import { ProjectsService } from "../projects/projects.service";
import { WorkbookRolesService, type WorkbookRoleName } from "./workbook-roles.service";

const EDITABLE_WORKFLOW_STATES = new Set(["DRAFT", "REVISION_REQUIRED"]);

interface ActingUser {
  username: string;
}

interface WorkbookModelAccessInput {
  workbookId: string;
  projectId: string;
  mef: unknown;
  acting: ActingUser;
}

interface WorkbookModelAccess {
  projectRole: ProjectAccessRole;
  workbookRoles: WorkbookRoleName[];
  workflowState: string;
}

type WorkbookModelOperation = "edit" | "execute";

function workflowStateOf(mef: unknown): string {
  if (typeof mef !== "object" || mef === null || !("workflowState" in mef)) return "DRAFT";
  const state = (mef as { workflowState?: unknown }).workflowState;
  return typeof state === "string" && state.length > 0 ? state : "DRAFT";
}

function operationDescription(operation: WorkbookModelOperation): string {
  return operation === "edit" ? "edit method models" : "execute method analyses";
}

@Injectable()
export class WorkbookModelAccessService {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly rolesService: WorkbookRolesService,
  ) {}

  private async requireAuthoringAccess(
    operation: WorkbookModelOperation,
    input: WorkbookModelAccessInput,
  ): Promise<WorkbookModelAccess> {
    const { role: projectRole } = await this.projectsService.resolveAccess(
      input.projectId,
      input.acting,
    );
    const description = operationDescription(operation);
    if (projectRole === "viewer") {
      throw new ForbiddenException(`You cannot ${description} in this project`);
    }

    const workbookRoles = await this.rolesService.resolveEffectiveRoles(
      input.workbookId,
      input.acting.username,
    );
    if (!workbookRoles.includes("preparer") && !workbookRoles.includes("co_preparer")) {
      throw new ForbiddenException(`Only workbook preparers can ${description}`);
    }

    const workflowState = workflowStateOf(input.mef);
    if (!EDITABLE_WORKFLOW_STATES.has(workflowState)) {
      throw new ForbiddenException(
        `Cannot ${description} while the workbook is in state ${workflowState}`,
      );
    }

    return { projectRole, workbookRoles, workflowState };
  }

  requireEdit(input: WorkbookModelAccessInput): Promise<WorkbookModelAccess> {
    return this.requireAuthoringAccess("edit", input);
  }

  requireExecution(input: WorkbookModelAccessInput): Promise<WorkbookModelAccess> {
    return this.requireAuthoringAccess("execute", input);
  }
}

export type { WorkbookModelAccess, WorkbookModelAccessInput };

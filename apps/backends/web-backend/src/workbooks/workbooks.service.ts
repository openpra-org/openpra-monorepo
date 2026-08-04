import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, isValidObjectId } from "mongoose";
import {
  type CreateWorkbookRequest,
  type UpdateWorkbookRequest,
  type Workbook as WorkbookDto,
  type WorkbookListResponse,
} from "interfaces-shared-types";
import { User, type UserDocument } from "../users/user.schema";
import { ProjectsService } from "../projects/projects.service";
import { Workbook, type WorkbookDocument } from "./workbook.schema";
import { WorkbookElementRegistry, type WorkbookExampleVariant } from "./workbook-element-registry";
import { WorkbookRolesService } from "./workbook-roles.service";
import { AnalyticsService } from "../analytics/analytics.service";

function computeInitials(fullName: string): string {
  const parts = fullName.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function toDto(doc: WorkbookDocument): WorkbookDto {
  return {
    id: String(doc._id),
    projectId: doc.projectId,
    elementCode: doc.elementCode,
    name: doc.name,
    status: doc.status,
    version: doc.version,
    ownerUsername: doc.ownerUsername,
    ownerFullName: doc.ownerFullName,
    ownerInitials: computeInitials(doc.ownerFullName),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

interface ActingUser {
  username: string;
}

export interface ProjectExampleOption {
  id: string;
  label: string;
}

export interface ProjectExampleInfo {
  elements: string[];
  options: ProjectExampleOption[];
}

export interface GeneratedExampleWorkbook {
  elementCode: string;
  exampleId: string;
  workbookId: string | null;
  workbookName: string;
  action: "created" | "repopulated" | "skipped";
  reason?: string;
}

export interface GenerateExamplesResult {
  generated: GeneratedExampleWorkbook[];
}

interface ExampleCapableElement {
  elementCode: string;
  variants: WorkbookExampleVariant[];
  loadExample: (workbookId: string, acting: ActingUser, exampleId: string) => Promise<void>;
}

@Injectable()
export class WorkbooksService {
  constructor(
    @InjectModel(Workbook.name) private readonly workbookModel: Model<WorkbookDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly projectsService: ProjectsService,
    private readonly elementRegistry: WorkbookElementRegistry,
    private readonly rolesService: WorkbookRolesService,
    @Optional() private readonly analytics?: AnalyticsService,
  ) {}

  async listWorkbooks(projectId: string, elementCode: string, acting: ActingUser): Promise<WorkbookListResponse> {
    await this.projectsService.resolveAccess(projectId, acting);
    const docs = await this.workbookModel
      .find({ projectId, elementCode })
      .sort({ updatedAt: -1 })
      .exec();
    return { workbooks: docs.map(toDto) };
  }

  async createWorkbook(projectId: string, payload: CreateWorkbookRequest, acting: ActingUser): Promise<WorkbookDto> {
    const { role, doc: project } = await this.projectsService.resolveAccess(projectId, acting);
    if (role === "viewer") throw new ForbiddenException("You cannot create workbooks in this project");
    const owner = await this.userModel.findOne({ username: acting.username }).lean();
    if (!owner) throw new NotFoundException("Acting user not found");
    const created = await this.workbookModel.create({
      projectId,
      elementCode: payload.elementCode,
      name: payload.name,
      status: "draft",
      version: 1,
      ownerUsername: owner.username,
      ownerFullName: owner.fullName,
    });
    const adapter = this.elementRegistry.tryGet(payload.elementCode);
    if (adapter !== undefined) {
      await adapter.createBlank(String(created._id), projectId, payload.name, owner.username);
      await this.rolesService.createInitialPreparer(String(created._id), owner.username);
    }
    try {
      await this.analytics?.recordWorkbookCreated({
        userId: String(owner._id),
        username: owner.username,
        projectId,
        workbookId: String(created._id),
        technicalElement: payload.elementCode,
        projectType: project.mode,
      });
    } catch (error) {
      console.error("Could not record workbook analytics", error);
    }
    return toDto(created);
  }

  private exampleCapableElements(): ExampleCapableElement[] {
    const out: ExampleCapableElement[] = [];
    for (const adapter of this.elementRegistry.list()) {
      const variantsOf = adapter.exampleVariants;
      const load = adapter.loadExample;
      if (variantsOf === undefined || load === undefined) continue;
      const variants = variantsOf.call(adapter);
      if (variants.length === 0) continue;
      out.push({
        elementCode: adapter.elementCode,
        variants,
        loadExample: async (workbookId, acting, exampleId): Promise<void> => {
          await load.call(adapter, workbookId, acting, exampleId);
        },
      });
    }
    return out;
  }

  async getProjectExampleInfo(projectId: string, acting: ActingUser): Promise<ProjectExampleInfo> {
    await this.projectsService.resolveAccess(projectId, acting);
    const capable = this.exampleCapableElements();
    const options: ProjectExampleOption[] = [];
    for (const entry of capable) {
      for (const variant of entry.variants) {
        if (!options.some((o) => o.id === variant.exampleId)) options.push({ id: variant.exampleId, label: variant.label });
      }
    }
    if (options.length > 1) options.push({ id: "both", label: "Both reactors" });
    return { elements: capable.map((e) => e.elementCode), options };
  }

  async generateExamples(projectId: string, exampleId: string | undefined, acting: ActingUser): Promise<GenerateExamplesResult> {
    const { role } = await this.projectsService.resolveAccess(projectId, acting);
    if (role === "viewer") throw new ForbiddenException("You cannot create workbooks in this project");
    const capable = this.exampleCapableElements();
    const available: string[] = [];
    for (const entry of capable) {
      for (const variant of entry.variants) {
        if (!available.includes(variant.exampleId)) available.push(variant.exampleId);
      }
    }
    if (available.length === 0) throw new BadRequestException("No example workbooks are available");
    const chosen = exampleId === undefined || exampleId.length === 0 ? available[0] : exampleId;
    if (chosen !== "both" && !available.includes(chosen)) throw new BadRequestException(`Unknown example "${chosen}"`);
    const requested = chosen === "both" ? available : [chosen];
    const generated: GeneratedExampleWorkbook[] = [];
    for (const entry of capable) {
      for (const variant of entry.variants) {
        if (!requested.includes(variant.exampleId)) continue;
        try {
          const existing = await this.workbookModel.findOne({ projectId, elementCode: entry.elementCode, name: variant.workbookName }).exec();
          let workbookId: string;
          let action: "created" | "repopulated";
          if (existing === null) {
            const created = await this.createWorkbook(projectId, { elementCode: entry.elementCode, name: variant.workbookName }, acting);
            workbookId = created.id;
            action = "created";
          } else {
            workbookId = String(existing._id);
            action = "repopulated";
          }
          await entry.loadExample(workbookId, acting, variant.exampleId);
          generated.push({ elementCode: entry.elementCode, exampleId: variant.exampleId, workbookId, workbookName: variant.workbookName, action });
        } catch (err) {
          generated.push({ elementCode: entry.elementCode, exampleId: variant.exampleId, workbookId: null, workbookName: variant.workbookName, action: "skipped", reason: (err as { message?: string }).message ?? "Could not load the example" });
        }
      }
    }
    return { generated };
  }

  async updateWorkbook(
    projectId: string,
    id: string,
    payload: UpdateWorkbookRequest,
    acting: ActingUser,
  ): Promise<WorkbookDto> {
    const { role } = await this.projectsService.resolveAccess(projectId, acting);
    if (role === "viewer") throw new ForbiddenException("You cannot edit workbooks in this project");
    const doc = await this.findScoped(projectId, id);
    if (payload.name !== undefined) doc.name = payload.name;
    if (payload.status !== undefined) doc.status = payload.status;
    await doc.save();
    return toDto(doc);
  }

  async deleteWorkbook(projectId: string, id: string, acting: ActingUser): Promise<void> {
    const { role } = await this.projectsService.resolveAccess(projectId, acting);
    if (role === "viewer") throw new ForbiddenException("You cannot delete workbooks in this project");
    const doc = await this.findScoped(projectId, id);
    await doc.deleteOne();
  }

  private async findScoped(projectId: string, id: string): Promise<WorkbookDocument> {
    if (!isValidObjectId(id)) throw new NotFoundException("Workbook not found");
    const doc = await this.workbookModel.findById(id).exec();
    if (!doc || doc.projectId !== projectId) throw new NotFoundException("Workbook not found");
    return doc;
  }
}

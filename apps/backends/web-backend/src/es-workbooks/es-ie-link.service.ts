import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, isValidObjectId } from "mongoose";
import { ProjectsService } from "../projects/projects.service";
import { WorkbookRolesService } from "../workbooks/workbook-roles.service";
import { ExampleWorkbooksService } from "../example-workbooks/example-workbooks.service";
import { Workbook, type WorkbookDocument } from "../workbooks/workbook.schema";
import { IeWorkbook, type IeWorkbookDocument } from "../ie-workbooks/ie-workbook.schema";
import { EsWorkbook, type EsWorkbookDocument } from "./es-workbook.schema";

const EXAMPLE_SENTINEL = "example";

interface ActingUser {
  username: string;
}

export interface AvailableIeWorkbook {
  workbookId: string;
  name: string;
  workflowState: string;
  initiatorCount: number;
  groupCount: number;
  updatedAt: string;
}

export interface ImportedIeInitiator {
  id: string;
  name: string;
  category: string;
}

export interface EsIeLinkStatus {
  linkedIeWorkbookId: string | null;
  linkedName: string | null;
  initiators: ImportedIeInitiator[];
}

interface IeMefShape {
  workflowState?: string;
  initiators?: { uuid: string; name: string; category: string }[];
  initiatingEventGroups?: { uuid: string }[];
}

interface EsScopeShape {
  scopeDefinition?: {
    plantOperatingStateIds?: string[];
    initiatingEventIds?: string[];
    radioactiveMaterialSources?: string[];
    radionuclideBarriers?: string[];
  };
}

@Injectable()
export class EsIeLinkService {
  constructor(
    @InjectModel(EsWorkbook.name) private readonly esWorkbookModel: Model<EsWorkbookDocument>,
    @InjectModel(Workbook.name) private readonly workbookModel: Model<WorkbookDocument>,
    @InjectModel(IeWorkbook.name) private readonly ieWorkbookModel: Model<IeWorkbookDocument>,
    private readonly projectsService: ProjectsService,
    private readonly rolesService: WorkbookRolesService,
    private readonly exampleWorkbooksService: ExampleWorkbooksService,
  ) {}

  private async requireEs(workbookId: string, acting: ActingUser): Promise<EsWorkbookDocument> {
    const es = await this.esWorkbookModel.findOne({ workbookId }).exec();
    if (!es) throw new NotFoundException("ES workbook not found");
    await this.projectsService.resolveAccess(es.projectId, acting);
    return es;
  }

  async availableIe(workbookId: string, acting: ActingUser): Promise<AvailableIeWorkbook[]> {
    const es = await this.requireEs(workbookId, acting);
    const registry = await this.workbookModel.find({ projectId: es.projectId, elementCode: "IE" }).sort({ updatedAt: -1 }).exec();
    const out: AvailableIeWorkbook[] = [];
    for (const reg of registry) {
      const ie = await this.ieWorkbookModel.findOne({ workbookId: reg.id as string }).exec();
      if (!ie) continue;
      const mef = ie.mef as IeMefShape;
      out.push({
        workbookId: reg.id as string,
        name: reg.name,
        workflowState: mef.workflowState ?? "DRAFT",
        initiatorCount: (mef.initiators ?? []).length,
        groupCount: (mef.initiatingEventGroups ?? []).length,
        updatedAt: ie.updatedAt.toISOString(),
      });
    }
    return out;
  }

  private collectImported(mef: IeMefShape): ImportedIeInitiator[] {
    return (mef.initiators ?? []).map((i) => ({ id: i.uuid, name: i.name, category: i.category }));
  }

  async status(workbookId: string, acting: ActingUser): Promise<EsIeLinkStatus> {
    const es = await this.requireEs(workbookId, acting);
    if (typeof es.linkedIeWorkbookId !== "string" || es.linkedIeWorkbookId.length === 0) {
      return { linkedIeWorkbookId: null, linkedName: null, initiators: [] };
    }
    if (es.linkedIeWorkbookId === EXAMPLE_SENTINEL) {
      const bundle = await this.exampleWorkbooksService.getIeBundle();
      return { linkedIeWorkbookId: EXAMPLE_SENTINEL, linkedName: "IE Workbook Example", initiators: this.collectImported(bundle.ie.mef as IeMefShape) };
    }
    const ie = await this.ieWorkbookModel.findOne({ workbookId: es.linkedIeWorkbookId }).exec();
    if (!ie) return { linkedIeWorkbookId: es.linkedIeWorkbookId, linkedName: null, initiators: [] };
    const reg = isValidObjectId(es.linkedIeWorkbookId) ? await this.workbookModel.findById(es.linkedIeWorkbookId).exec() : null;
    return { linkedIeWorkbookId: es.linkedIeWorkbookId, linkedName: reg?.name ?? null, initiators: this.collectImported(ie.mef as IeMefShape) };
  }

  async link(workbookId: string, ieWorkbookId: string, acting: ActingUser): Promise<EsIeLinkStatus> {
    const es = await this.requireEs(workbookId, acting);
    const myRoles = await this.rolesService.resolveEffectiveRoles(workbookId, acting.username);
    if (!myRoles.includes("preparer") && !myRoles.includes("co_preparer")) throw new ForbiddenException("Only preparers can link an IE workbook");
    const ie = await this.ieWorkbookModel.findOne({ workbookId: ieWorkbookId }).exec();
    if (!ie) throw new NotFoundException("IE workbook not found");
    if (ie.projectId !== es.projectId) throw new BadRequestException("IE workbook is in a different project");
    const initiators = this.collectImported(ie.mef as IeMefShape);
    const esMef = es.mef as EsScopeShape;
    esMef.scopeDefinition = {
      ...esMef.scopeDefinition,
      initiatingEventIds: initiators.map((i) => i.id),
    };
    es.mef = esMef;
    es.linkedIeWorkbookId = ieWorkbookId;
    await es.save();
    return this.status(workbookId, acting);
  }

  async unlink(workbookId: string, acting: ActingUser): Promise<EsIeLinkStatus> {
    const es = await this.requireEs(workbookId, acting);
    const myRoles = await this.rolesService.resolveEffectiveRoles(workbookId, acting.username);
    if (!myRoles.includes("preparer") && !myRoles.includes("co_preparer")) throw new ForbiddenException("Only preparers can unlink an IE workbook");
    es.linkedIeWorkbookId = null;
    const esMef = es.mef as EsScopeShape;
    esMef.scopeDefinition = {
      ...esMef.scopeDefinition,
      initiatingEventIds: [],
    };
    es.mef = esMef;
    await es.save();
    return { linkedIeWorkbookId: null, linkedName: null, initiators: [] };
  }
}

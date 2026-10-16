import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, isValidObjectId } from "mongoose";
import { ProjectsService } from "../projects/projects.service";
import { WorkbookRolesService } from "../workbooks/workbook-roles.service";
import { ExampleWorkbooksService } from "../example-workbooks/example-workbooks.service";
import { Workbook, type WorkbookDocument } from "../workbooks/workbook.schema";
import { IeWorkbook, type IeWorkbookDocument } from "../ie-workbooks/ie-workbook.schema";
import { EsWorkbook, type EsWorkbookDocument } from "./es-workbook.schema";
import {
  createWorkbookRevisionFilter,
  readWorkbookRevision,
  workbookRevisionConflict,
} from "../workbooks/workbook-revision";
import { esDocumentLink, withEsLink, type EsLinkedMef } from "./es-links";

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

export interface ImportedIeGroup {
  id: string;
  name: string;
}

export interface EsIeLinkStatus {
  linkedIeWorkbookId: string | null;
  linkedName: string | null;
  groups: ImportedIeGroup[];
}

interface IeMefShape {
  workflowState?: string;
  initiators?: { uuid: string; name: string; category: string }[];
  initiatingEventGroups?: { uuid: string; name: string }[];
}

interface EsScopeShape extends EsLinkedMef {
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

  private collectImported(mef: IeMefShape): ImportedIeGroup[] {
    return (mef.initiatingEventGroups ?? []).map((group) => ({ id: group.uuid, name: group.name }));
  }

  async status(workbookId: string, acting: ActingUser): Promise<EsIeLinkStatus> {
    const es = await this.requireEs(workbookId, acting);
    const linkedId = esDocumentLink(es, "IE");
    if (linkedId === null) {
      return { linkedIeWorkbookId: null, linkedName: null, groups: [] };
    }
    if (linkedId === EXAMPLE_SENTINEL) {
      const variant = es.exampleVariant === "htgr" || es.exampleVariant === "sfr" || es.exampleVariant === "hcl"
        ? es.exampleVariant
        : "sfr";
      const bundle = await this.exampleWorkbooksService.getIeBundle(variant);
      const linkedName = variant === "htgr"
        ? "Generic HTGR IE Workbook"
        : variant === "sfr"
          ? "Generic SFR IE Workbook"
          : "HCL dissertation case study — Initiating Events";
      return { linkedIeWorkbookId: EXAMPLE_SENTINEL, linkedName, groups: this.collectImported(bundle.ie.mef as IeMefShape) };
    }
    const ie = await this.ieWorkbookModel.findOne({ workbookId: linkedId }).exec();
    if (!ie) return { linkedIeWorkbookId: linkedId, linkedName: null, groups: [] };
    const reg = isValidObjectId(linkedId) ? await this.workbookModel.findById(linkedId).exec() : null;
    return { linkedIeWorkbookId: linkedId, linkedName: reg?.name ?? null, groups: this.collectImported(ie.mef as IeMefShape) };
  }

  async link(workbookId: string, ieWorkbookId: string, acting: ActingUser): Promise<EsIeLinkStatus> {
    const es = await this.requireEs(workbookId, acting);
    const expectedRevision = readWorkbookRevision(es);
    const myRoles = await this.rolesService.resolveEffectiveRoles(workbookId, acting.username);
    if (!myRoles.includes("preparer") && !myRoles.includes("co_preparer")) throw new ForbiddenException("Only preparers can link an IE workbook");
    const ie = await this.ieWorkbookModel.findOne({ workbookId: ieWorkbookId }).exec();
    if (!ie) throw new NotFoundException("IE workbook not found");
    if (ie.projectId !== es.projectId) throw new BadRequestException("IE workbook is in a different project");
    const groups = this.collectImported(ie.mef as IeMefShape);
    const currentMef = es.mef as EsScopeShape;
    const nextMef = {
      ...currentMef,
      linkedWorkbooks: withEsLink(currentMef.linkedWorkbooks, "IE", ieWorkbookId),
      scopeDefinition: {
        ...currentMef.scopeDefinition,
        initiatingEventIds: groups.map((group) => group.id),
      },
    };
    const updated = await this.esWorkbookModel
      .findOneAndUpdate(
        createWorkbookRevisionFilter(workbookId, expectedRevision),
        {
          $set: {
            mef: nextMef,
            linkedIeWorkbookId: null,
            revision: expectedRevision + 1,
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updated) throw workbookRevisionConflict(expectedRevision);
    return this.status(workbookId, acting);
  }

  async unlink(workbookId: string, acting: ActingUser): Promise<EsIeLinkStatus> {
    const es = await this.requireEs(workbookId, acting);
    const expectedRevision = readWorkbookRevision(es);
    const myRoles = await this.rolesService.resolveEffectiveRoles(workbookId, acting.username);
    if (!myRoles.includes("preparer") && !myRoles.includes("co_preparer")) throw new ForbiddenException("Only preparers can unlink an IE workbook");
    const currentMef = es.mef as EsScopeShape;
    const nextMef = {
      ...currentMef,
      linkedWorkbooks: withEsLink(currentMef.linkedWorkbooks, "IE", null),
      scopeDefinition: {
        ...currentMef.scopeDefinition,
        initiatingEventIds: [],
      },
    };
    const updated = await this.esWorkbookModel
      .findOneAndUpdate(
        createWorkbookRevisionFilter(workbookId, expectedRevision),
        {
          $set: {
            mef: nextMef,
            linkedIeWorkbookId: null,
            revision: expectedRevision + 1,
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updated) throw workbookRevisionConflict(expectedRevision);
    return { linkedIeWorkbookId: null, linkedName: null, groups: [] };
  }
}

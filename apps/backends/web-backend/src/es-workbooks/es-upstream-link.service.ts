import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, isValidObjectId } from "mongoose";
import { ProjectsService } from "../projects/projects.service";
import { WorkbookRolesService } from "../workbooks/workbook-roles.service";
import { ExampleWorkbooksService } from "../example-workbooks/example-workbooks.service";
import { Workbook, type WorkbookDocument } from "../workbooks/workbook.schema";
import { PosWorkbook, type PosWorkbookDocument } from "../pos-workbooks/pos-workbook.schema";
import { IeWorkbook, type IeWorkbookDocument } from "../ie-workbooks/ie-workbook.schema";
import { EsWorkbook, type EsWorkbookDocument } from "./es-workbook.schema";

const EXAMPLE_SENTINEL = "example";

interface ActingUser {
  username: string;
}

export interface ImportedIeGroup {
  id: string;
  name: string;
  memberCount: number;
  meanFrequency: number | null;
}

export interface ImportedPosState {
  id: string;
  name: string;
  operatingMode: string;
  meanDurationHours: number;
  meanEntryFrequency: number;
}

export interface ImportedPosSource {
  id: string;
  name: string;
  location: string;
  barriers: string[];
}

export interface EsUpstreamLinkStatus {
  linkedIeWorkbookId: string | null;
  linkedIeName: string | null;
  initiatingEventGroups: ImportedIeGroup[];
  linkedPosWorkbookId: string | null;
  linkedPosName: string | null;
  states: ImportedPosState[];
  sources: ImportedPosSource[];
}

interface IeMefShape {
  workflowState?: string;
  initiators?: { uuid: string; name: string }[];
  initiatingEventGroups?: {
    uuid: string;
    name: string;
    memberInitiatorIds: string[];
    meanFrequency?: number | { value: number };
  }[];
}

interface PosMefShape {
  workflowState?: string;
  plantOperatingStates?: {
    uuid: string;
    name: string;
    operatingMode: string;
    meanDurationHours: number;
    meanEntryFrequency: number | { value: number };
    radioactiveMaterialSources?: { uuid: string; name: string; location: string; barriers: string[] }[];
  }[];
}

@Injectable()
export class EsUpstreamLinkService {
  constructor(
    @InjectModel(EsWorkbook.name) private readonly esWorkbookModel: Model<EsWorkbookDocument>,
    @InjectModel(Workbook.name) private readonly workbookModel: Model<WorkbookDocument>,
    @InjectModel(PosWorkbook.name) private readonly posWorkbookModel: Model<PosWorkbookDocument>,
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

  private freqValue(f: number | { value: number } | undefined): number | null {
    if (f === undefined) return null;
    return typeof f === "number" ? f : f.value;
  }

  private collectIeImported(mef: IeMefShape): ImportedIeGroup[] {
    return (mef.initiatingEventGroups ?? []).map((g) => ({
      id: g.uuid,
      name: g.name,
      memberCount: g.memberInitiatorIds.length,
      meanFrequency: this.freqValue(g.meanFrequency),
    }));
  }

  private collectPosImported(mef: PosMefShape): { states: ImportedPosState[]; sources: ImportedPosSource[] } {
    const states: ImportedPosState[] = (mef.plantOperatingStates ?? []).map((s) => ({
      id: s.uuid,
      name: s.name,
      operatingMode: s.operatingMode,
      meanDurationHours: s.meanDurationHours,
      meanEntryFrequency: this.freqValue(s.meanEntryFrequency) ?? 0,
    }));
    const sourceById = new Map<string, ImportedPosSource>();
    for (const s of mef.plantOperatingStates ?? []) {
      for (const src of s.radioactiveMaterialSources ?? []) {
        if (!sourceById.has(src.uuid)) {
          sourceById.set(src.uuid, { id: src.uuid, name: src.name, location: src.location, barriers: src.barriers });
        }
      }
    }
    return { states, sources: Array.from(sourceById.values()) };
  }

  async status(workbookId: string, acting: ActingUser): Promise<EsUpstreamLinkStatus> {
    const es = await this.requireEs(workbookId, acting);

    let ieGroups: ImportedIeGroup[] = [];
    let linkedIeName: string | null = null;
    const linkedIeId = typeof es.linkedIeWorkbookId === "string" && es.linkedIeWorkbookId.length > 0 ? es.linkedIeWorkbookId : null;

    if (linkedIeId === EXAMPLE_SENTINEL) {
      const bundle = await this.exampleWorkbooksService.getIeBundle();
      ieGroups = this.collectIeImported(bundle.ie.mef as IeMefShape);
      linkedIeName = "IE Workbook Example";
    } else if (linkedIeId !== null) {
      const ie = await this.ieWorkbookModel.findOne({ workbookId: linkedIeId }).exec();
      if (ie) {
        ieGroups = this.collectIeImported(ie.mef as IeMefShape);
        const reg = isValidObjectId(linkedIeId) ? await this.workbookModel.findById(linkedIeId).exec() : null;
        linkedIeName = reg?.name ?? null;
      }
    }

    let states: ImportedPosState[] = [];
    let sources: ImportedPosSource[] = [];
    let linkedPosName: string | null = null;
    const linkedPosId = typeof es.linkedPosWorkbookId === "string" && es.linkedPosWorkbookId.length > 0 ? es.linkedPosWorkbookId : null;

    if (linkedPosId === EXAMPLE_SENTINEL) {
      const bundle = await this.exampleWorkbooksService.getPosBundle();
      const imported = this.collectPosImported(bundle.pos.mef as PosMefShape);
      states = imported.states;
      sources = imported.sources;
      linkedPosName = "POS Workbook Example";
    } else if (linkedPosId !== null) {
      const pos = await this.posWorkbookModel.findOne({ workbookId: linkedPosId }).exec();
      if (pos) {
        const imported = this.collectPosImported(pos.mef as PosMefShape);
        states = imported.states;
        sources = imported.sources;
        const reg = isValidObjectId(linkedPosId) ? await this.workbookModel.findById(linkedPosId).exec() : null;
        linkedPosName = reg?.name ?? null;
      }
    }

    return {
      linkedIeWorkbookId: linkedIeId,
      linkedIeName,
      initiatingEventGroups: ieGroups,
      linkedPosWorkbookId: linkedPosId,
      linkedPosName,
      states,
      sources,
    };
  }

  async linkIe(workbookId: string, ieWorkbookId: string, acting: ActingUser): Promise<EsUpstreamLinkStatus> {
    const es = await this.requireEs(workbookId, acting);
    const myRoles = await this.rolesService.resolveEffectiveRoles(workbookId, acting.username);
    if (!myRoles.includes("preparer") && !myRoles.includes("co_preparer")) throw new ForbiddenException("Only preparers can link an IE workbook");
    const ie = await this.ieWorkbookModel.findOne({ workbookId: ieWorkbookId }).exec();
    if (!ie) throw new NotFoundException("IE workbook not found");
    if (ie.projectId !== es.projectId) throw new BadRequestException("IE workbook is in a different project");
    const ieMef = ie.mef as IeMefShape;
    const groupIds = (ieMef.initiatingEventGroups ?? []).map((g) => g.uuid);
    const esMef = es.mef as { scopeDefinition?: { initiatingEventIds?: string[] } };
    if (esMef.scopeDefinition) esMef.scopeDefinition.initiatingEventIds = groupIds;
    es.mef = esMef;
    es.linkedIeWorkbookId = ieWorkbookId;
    await es.save();
    return this.status(workbookId, acting);
  }

  async linkPos(workbookId: string, posWorkbookId: string, acting: ActingUser): Promise<EsUpstreamLinkStatus> {
    const es = await this.requireEs(workbookId, acting);
    const myRoles = await this.rolesService.resolveEffectiveRoles(workbookId, acting.username);
    if (!myRoles.includes("preparer") && !myRoles.includes("co_preparer")) throw new ForbiddenException("Only preparers can link a POS workbook");
    const pos = await this.posWorkbookModel.findOne({ workbookId: posWorkbookId }).exec();
    if (!pos) throw new NotFoundException("POS workbook not found");
    if (pos.projectId !== es.projectId) throw new BadRequestException("POS workbook is in a different project");
    const posMef = pos.mef as PosMefShape;
    const stateIds = (posMef.plantOperatingStates ?? []).map((s) => s.uuid);
    const esMef = es.mef as { scopeDefinition?: { plantOperatingStateIds?: string[] } };
    if (esMef.scopeDefinition) esMef.scopeDefinition.plantOperatingStateIds = stateIds;
    es.mef = esMef;
    es.linkedPosWorkbookId = posWorkbookId;
    await es.save();
    return this.status(workbookId, acting);
  }

  async unlinkAll(workbookId: string, acting: ActingUser): Promise<EsUpstreamLinkStatus> {
    const es = await this.requireEs(workbookId, acting);
    const myRoles = await this.rolesService.resolveEffectiveRoles(workbookId, acting.username);
    if (!myRoles.includes("preparer") && !myRoles.includes("co_preparer")) throw new ForbiddenException("Only preparers can unlink upstream workbooks");
    es.linkedIeWorkbookId = null;
    es.linkedPosWorkbookId = null;
    const esMef = es.mef as { scopeDefinition?: { plantOperatingStateIds?: string[]; initiatingEventIds?: string[] } };
    if (esMef.scopeDefinition) {
      esMef.scopeDefinition.plantOperatingStateIds = [];
      esMef.scopeDefinition.initiatingEventIds = [];
    }
    es.mef = esMef;
    await es.save();
    return { linkedIeWorkbookId: null, linkedIeName: null, initiatingEventGroups: [], linkedPosWorkbookId: null, linkedPosName: null, states: [], sources: [] };
  }
}

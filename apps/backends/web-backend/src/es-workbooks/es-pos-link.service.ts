import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, isValidObjectId } from "mongoose";
import { ProjectsService } from "../projects/projects.service";
import { WorkbookRolesService } from "../workbooks/workbook-roles.service";
import { ExampleWorkbooksService } from "../example-workbooks/example-workbooks.service";
import { Workbook, type WorkbookDocument } from "../workbooks/workbook.schema";
import { PosWorkbook, type PosWorkbookDocument } from "../pos-workbooks/pos-workbook.schema";
import { EsWorkbook, type EsWorkbookDocument } from "./es-workbook.schema";
import {
  createWorkbookRevisionFilter,
  readWorkbookRevision,
  workbookRevisionConflict,
} from "../workbooks/workbook-revision";

const EXAMPLE_SENTINEL = "example";

interface ActingUser {
  username: string;
}

export interface AvailablePosWorkbook {
  workbookId: string;
  name: string;
  workflowState: string;
  stateCount: number;
  sourceCount: number;
  updatedAt: string;
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

export interface EsPosLinkStatus {
  linkedPosWorkbookId: string | null;
  linkedName: string | null;
  states: ImportedPosState[];
  sources: ImportedPosSource[];
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

interface EsScopeShape {
  scopeDefinition?: {
    plantOperatingStateIds?: string[];
    initiatingEventIds?: string[];
    radioactiveMaterialSources?: string[];
    radionuclideBarriers?: string[];
  };
}

@Injectable()
export class EsPosLinkService {
  constructor(
    @InjectModel(EsWorkbook.name) private readonly esWorkbookModel: Model<EsWorkbookDocument>,
    @InjectModel(Workbook.name) private readonly workbookModel: Model<WorkbookDocument>,
    @InjectModel(PosWorkbook.name) private readonly posWorkbookModel: Model<PosWorkbookDocument>,
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

  private freqValue(f: number | { value: number }): number {
    return typeof f === "number" ? f : f.value;
  }

  async availablePos(workbookId: string, acting: ActingUser): Promise<AvailablePosWorkbook[]> {
    const es = await this.requireEs(workbookId, acting);
    const registry = await this.workbookModel.find({ projectId: es.projectId, elementCode: "POS" }).sort({ updatedAt: -1 }).exec();
    const out: AvailablePosWorkbook[] = [];
    for (const reg of registry) {
      const pos = await this.posWorkbookModel.findOne({ workbookId: reg.id as string }).exec();
      if (!pos) continue;
      const mef = pos.mef as PosMefShape;
      const states = mef.plantOperatingStates ?? [];
      const sources = states.reduce((acc, s) => acc + (s.radioactiveMaterialSources?.length ?? 0), 0);
      out.push({
        workbookId: reg.id as string,
        name: reg.name,
        workflowState: mef.workflowState ?? "DRAFT",
        stateCount: states.length,
        sourceCount: sources,
        updatedAt: pos.updatedAt.toISOString(),
      });
    }
    return out;
  }

  private collectImported(mef: PosMefShape): { states: ImportedPosState[]; sources: ImportedPosSource[] } {
    const states: ImportedPosState[] = (mef.plantOperatingStates ?? []).map((s) => ({
      id: s.uuid,
      name: s.name,
      operatingMode: s.operatingMode,
      meanDurationHours: s.meanDurationHours,
      meanEntryFrequency: this.freqValue(s.meanEntryFrequency),
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

  async status(workbookId: string, acting: ActingUser): Promise<EsPosLinkStatus> {
    const es = await this.requireEs(workbookId, acting);
    if (typeof es.linkedPosWorkbookId !== "string" || es.linkedPosWorkbookId.length === 0) {
      return { linkedPosWorkbookId: null, linkedName: null, states: [], sources: [] };
    }
    if (es.linkedPosWorkbookId === EXAMPLE_SENTINEL) {
      const variant = es.exampleVariant === "htgr" ? "htgr" : "sfr";
      const bundle = await this.exampleWorkbooksService.getPosBundle(variant);
      const { states, sources } = this.collectImported(bundle.pos.mef as PosMefShape);
      return { linkedPosWorkbookId: EXAMPLE_SENTINEL, linkedName: variant === "htgr" ? "Generic HTGR POS Workbook" : "Generic SFR POS Workbook", states, sources };
    }
    const pos = await this.posWorkbookModel.findOne({ workbookId: es.linkedPosWorkbookId }).exec();
    if (!pos) return { linkedPosWorkbookId: es.linkedPosWorkbookId, linkedName: null, states: [], sources: [] };
    const reg = isValidObjectId(es.linkedPosWorkbookId) ? await this.workbookModel.findById(es.linkedPosWorkbookId).exec() : null;
    const { states, sources } = this.collectImported(pos.mef as PosMefShape);
    return { linkedPosWorkbookId: es.linkedPosWorkbookId, linkedName: reg?.name ?? null, states, sources };
  }

  async link(workbookId: string, posWorkbookId: string, acting: ActingUser): Promise<EsPosLinkStatus> {
    const es = await this.requireEs(workbookId, acting);
    const expectedRevision = readWorkbookRevision(es);
    const myRoles = await this.rolesService.resolveEffectiveRoles(workbookId, acting.username);
    if (!myRoles.includes("preparer") && !myRoles.includes("co_preparer")) throw new ForbiddenException("Only preparers can link a POS workbook");
    const pos = await this.posWorkbookModel.findOne({ workbookId: posWorkbookId }).exec();
    if (!pos) throw new NotFoundException("POS workbook not found");
    if (pos.projectId !== es.projectId) throw new BadRequestException("POS workbook is in a different project");
    const mef = pos.mef as PosMefShape;
    const { states, sources } = this.collectImported(mef);
    const barriers = Array.from(new Set(sources.flatMap((src) => src.barriers)));
    const currentMef = es.mef as EsScopeShape;
    const nextMef = {
      ...currentMef,
      scopeDefinition: {
        ...currentMef.scopeDefinition,
        plantOperatingStateIds: states.map((s) => s.id),
        radioactiveMaterialSources: sources.map((s) => s.name),
        radionuclideBarriers: barriers,
      },
    };
    const updated = await this.esWorkbookModel
      .findOneAndUpdate(
        createWorkbookRevisionFilter(workbookId, expectedRevision),
        {
          $set: {
            mef: nextMef,
            linkedPosWorkbookId: posWorkbookId,
            revision: expectedRevision + 1,
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updated) throw workbookRevisionConflict(expectedRevision);
    return this.status(workbookId, acting);
  }

  async unlink(workbookId: string, acting: ActingUser): Promise<EsPosLinkStatus> {
    const es = await this.requireEs(workbookId, acting);
    const expectedRevision = readWorkbookRevision(es);
    const myRoles = await this.rolesService.resolveEffectiveRoles(workbookId, acting.username);
    if (!myRoles.includes("preparer") && !myRoles.includes("co_preparer")) throw new ForbiddenException("Only preparers can unlink a POS workbook");
    const currentMef = es.mef as EsScopeShape;
    const nextMef = {
      ...currentMef,
      scopeDefinition: {
        ...currentMef.scopeDefinition,
        plantOperatingStateIds: [],
        radioactiveMaterialSources: [],
        radionuclideBarriers: [],
      },
    };
    const updated = await this.esWorkbookModel
      .findOneAndUpdate(
        createWorkbookRevisionFilter(workbookId, expectedRevision),
        {
          $set: {
            mef: nextMef,
            linkedPosWorkbookId: null,
            revision: expectedRevision + 1,
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updated) throw workbookRevisionConflict(expectedRevision);
    return { linkedPosWorkbookId: null, linkedName: null, states: [], sources: [] };
  }
}

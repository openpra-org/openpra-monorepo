import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, isValidObjectId } from "mongoose";
import { ProjectsService } from "../projects/projects.service";
import { WorkbookRolesService } from "../workbooks/workbook-roles.service";
import { ExampleWorkbooksService } from "../example-workbooks/example-workbooks.service";
import { Workbook, type WorkbookDocument } from "../workbooks/workbook.schema";
import { PosWorkbook, type PosWorkbookDocument } from "../pos-workbooks/pos-workbook.schema";
import { IeWorkbook, type IeWorkbookDocument } from "./ie-workbook.schema";

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

export interface IePosLinkStatus {
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

@Injectable()
export class IePosLinkService {
  constructor(
    @InjectModel(IeWorkbook.name) private readonly ieWorkbookModel: Model<IeWorkbookDocument>,
    @InjectModel(Workbook.name) private readonly workbookModel: Model<WorkbookDocument>,
    @InjectModel(PosWorkbook.name) private readonly posWorkbookModel: Model<PosWorkbookDocument>,
    private readonly projectsService: ProjectsService,
    private readonly rolesService: WorkbookRolesService,
    private readonly exampleWorkbooksService: ExampleWorkbooksService,
  ) {}

  private async requireIe(workbookId: string, acting: ActingUser): Promise<IeWorkbookDocument> {
    const ie = await this.ieWorkbookModel.findOne({ workbookId }).exec();
    if (!ie) throw new NotFoundException("IE workbook not found");
    await this.projectsService.resolveAccess(ie.projectId, acting);
    return ie;
  }

  private freqValue(f: number | { value: number }): number {
    return typeof f === "number" ? f : f.value;
  }

  async availablePos(workbookId: string, acting: ActingUser): Promise<AvailablePosWorkbook[]> {
    const ie = await this.requireIe(workbookId, acting);
    const registry = await this.workbookModel.find({ projectId: ie.projectId, elementCode: "POS" }).sort({ updatedAt: -1 }).exec();
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

  async status(workbookId: string, acting: ActingUser): Promise<IePosLinkStatus> {
    const ie = await this.requireIe(workbookId, acting);
    if (typeof ie.linkedPosWorkbookId !== "string" || ie.linkedPosWorkbookId.length === 0) {
      return { linkedPosWorkbookId: null, linkedName: null, states: [], sources: [] };
    }
    if (ie.linkedPosWorkbookId === EXAMPLE_SENTINEL) {
      const bundle = await this.exampleWorkbooksService.getPosBundle();
      const { states, sources } = this.collectImported(bundle.pos.mef as PosMefShape);
      return { linkedPosWorkbookId: EXAMPLE_SENTINEL, linkedName: "POS Workbook Example", states, sources };
    }
    const pos = await this.posWorkbookModel.findOne({ workbookId: ie.linkedPosWorkbookId }).exec();
    if (!pos) return { linkedPosWorkbookId: ie.linkedPosWorkbookId, linkedName: null, states: [], sources: [] };
    const reg = isValidObjectId(ie.linkedPosWorkbookId) ? await this.workbookModel.findById(ie.linkedPosWorkbookId).exec() : null;
    const { states, sources } = this.collectImported(pos.mef as PosMefShape);
    return { linkedPosWorkbookId: ie.linkedPosWorkbookId, linkedName: reg?.name ?? null, states, sources };
  }

  async link(workbookId: string, posWorkbookId: string, acting: ActingUser): Promise<IePosLinkStatus> {
    const ie = await this.requireIe(workbookId, acting);
    const myRoles = await this.rolesService.resolveEffectiveRoles(workbookId, acting.username);
    if (!myRoles.includes("preparer") && !myRoles.includes("co_preparer")) throw new ForbiddenException("Only preparers can link a POS workbook");
    const pos = await this.posWorkbookModel.findOne({ workbookId: posWorkbookId }).exec();
    if (!pos) throw new NotFoundException("POS workbook not found");
    if (pos.projectId !== ie.projectId) throw new BadRequestException("POS workbook is in a different project");
    const mef = pos.mef as PosMefShape;
    const stateIds = (mef.plantOperatingStates ?? []).map((s) => s.uuid);
    const ieMef = ie.mef as { applicablePlantOperatingStates?: string[] };
    ieMef.applicablePlantOperatingStates = stateIds;
    ie.mef = ieMef;
    ie.linkedPosWorkbookId = posWorkbookId;
    await ie.save();
    return this.status(workbookId, acting);
  }

  async unlink(workbookId: string, acting: ActingUser): Promise<IePosLinkStatus> {
    const ie = await this.requireIe(workbookId, acting);
    const myRoles = await this.rolesService.resolveEffectiveRoles(workbookId, acting.username);
    if (!myRoles.includes("preparer") && !myRoles.includes("co_preparer")) throw new ForbiddenException("Only preparers can unlink a POS workbook");
    ie.linkedPosWorkbookId = null;
    const ieMef = ie.mef as { applicablePlantOperatingStates?: string[] };
    ieMef.applicablePlantOperatingStates = [];
    ie.mef = ieMef;
    await ie.save();
    return { linkedPosWorkbookId: null, linkedName: null, states: [], sources: [] };
  }
}

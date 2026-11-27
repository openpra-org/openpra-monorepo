import { Injectable } from "@nestjs/common";
import type { MechanisticSourceTermAnalysis } from "interfaces-mef-types/ms/mechanistic-source-term-analysis";
import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { rcWithCategory, rcWithLinkedData, type RcLinkedData } from "interfaces-shared-types/rc-workbooks/linked-data";
import { ExampleWorkbooksService } from "../example-workbooks/example-workbooks.service";
import { WorkbookElementRegistry } from "../workbooks/workbook-element-registry";

const EXAMPLE_PREFIX = "example-";

@Injectable()
export class RcLinkedSourcesService {
  constructor(private readonly registry: WorkbookElementRegistry, private readonly examples: ExampleWorkbooksService) {}

  private async sourceTerms(workbookId: string, projectId: string): Promise<MechanisticSourceTermAnalysis | undefined> {
    try {
      if (workbookId.startsWith(EXAMPLE_PREFIX)) {
        const variant = workbookId.split("-").slice(2).join("-");
        if (!this.examples.getMsExamples().some((entry) => entry.id === variant)) return undefined;
        return (await this.examples.getMsBundle(variant)).ms.mef as MechanisticSourceTermAnalysis;
      }
      const loaded = await this.registry.tryGet("MS")?.load(workbookId);
      if (loaded === undefined || loaded === null || loaded.projectId !== projectId) return undefined;
      return loaded.mef as MechanisticSourceTermAnalysis;
    } catch {
      return undefined;
    }
  }

  async linked(mef: RadiologicalConsequenceAnalysis, projectId: string): Promise<RcLinkedData> {
    const workbookId = mef.linkedWorkbooks?.MS;
    if (workbookId === undefined || workbookId.length === 0) return {};
    const analysis = await this.sourceTerms(workbookId, projectId);
    return analysis === undefined ? {} : { ms: { workbookId, analysis } };
  }

  async view(mef: RadiologicalConsequenceAnalysis, projectId: string): Promise<RadiologicalConsequenceAnalysis> {
    return rcWithLinkedData(mef, await this.linked(mef, projectId));
  }

  async viewFor(mef: RadiologicalConsequenceAnalysis, projectId: string, categoryId: string): Promise<RadiologicalConsequenceAnalysis> {
    const linked = await this.linked(mef, projectId);
    return linked.ms === undefined ? mef : rcWithLinkedData(rcWithCategory(mef, categoryId), linked);
  }
}

import { Named, Unique } from "../core/meta";
import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { HlrId, PlantStage, SRReference } from "../core/pra-common";

export interface MonitoredChange extends Unique, Named {
  changeType: "PLANT_DESIGN" | "OPERATION" | "PRA_TECHNOLOGY" | "INDUSTRY_EXPERIENCE";
  description: string;
  detectedAt: string;
  source: string;
  potentialPraImpact: string;
  status: "OPEN" | "EVALUATED" | "INCORPORATED" | "DEFERRED";
  implementsSrs: SRReference[];
}

export interface PraUpdateRecord extends Unique {
  description: string;
  performedAt: string;
  performedBy: string;
  affectedTechnicalElementIds: string[];
  basisForUpdate: string;
  consistencyWithPlant: "AS_BUILT" | "AS_OPERATED" | "AS_DESIGNED" | "AS_INTENDED_TO_OPERATE";
  implementsSrs: SRReference[];
}

export interface PendingChangeImpactAssessment extends Unique {
  pendingChangeIds: string[];
  individualImpacts: string[];
  cumulativeImpact: string;
  riskApplicationsAffected: string[];
  conclusion: string;
  implementsSrs: SRReference[];
}

export interface ComputerCodeControl extends Unique, Named {
  codeName: string;
  version: string;
  controlledArtifactPaths: string[];
  configurationManagementSystem: string;
  qualificationStatus: string;
  implementsSrs: SRReference[];
}

export interface ConfigurationControlDocumentation {
  programDescription: string;
  changeMonitoringProcess: string;
  praMaintenanceProcess: string;
  cumulativeImpactProcess: string;
  codeControlProcess: string;
  implementsSrs: SRReference[];
}

export interface PRAConfigurationControl
  extends TechnicalElement<TechnicalElementTypes.PRA_CONFIGURATION_CONTROL> {
  freezeDate: string;
  monitoredChanges: MonitoredChange[];
  praUpdateRecords: PraUpdateRecord[];
  pendingChangeAssessments: PendingChangeImpactAssessment[];
  computerCodeControls: ComputerCodeControl[];
  documentation: ConfigurationControlDocumentation;
  invokedPriorToFirstPeerReview: boolean;
}

export const CC_SR_CATALOG: Record<string, { hlr: HlrId; stages: PlantStage[] }> = {};

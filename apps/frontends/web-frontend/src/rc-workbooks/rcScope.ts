import type {
  RadiologicalConsequenceAnalysis,
  RcEvaluationSubElement,
  RcSubElement,
} from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { receptorCount, sitePopulation } from "interfaces-shared-types/rc-workbooks/site-receptors";
import { weatherTreatmentNames } from "interfaces-shared-types/rc-workbooks/weather-trials";

export const RC_SCOPE_ASPECTS = [
  { subElement: "RCPA", label: "Protective actions and site", step: "02" },
  { subElement: "RCME", label: "Meteorology", step: "03" },
  { subElement: "RCAD", label: "Atmospheric dispersion", step: "04" },
  { subElement: "RCDO", label: "Dosimetry", step: "05" },
  { subElement: "RCHE", label: "Health effects", step: "06" },
  { subElement: "RCEC", label: "Economic factors", step: "07" },
  { subElement: "RCQ", label: "Consequence quantification", step: "08" },
] as const satisfies readonly { subElement: RcEvaluationSubElement; label: string; step: string }[];

export function isRcAspectExcluded(rc: RadiologicalConsequenceAnalysis, aspect: RcSubElement): boolean {
  return rc.scope.evaluationDecisions?.some((decision) => decision.subElement === aspect && decision.included === false) ?? false;
}

function count(value: number, singular: string, plural = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function rcScopeTreatment(rc: RadiologicalConsequenceAnalysis, aspect: RcEvaluationSubElement): string {
  const parts: string[] = [];
  switch (aspect) {
    case "RCPA": {
      const site = rc.protectiveActionParameters.siteAndReceptors;
      if (site?.geometry) {
        parts.push(count(receptorCount(site.geometry), site.geometry.kind === "cells" ? "receptor cell" : "receptor point"));
        const population = sitePopulation(site.geometry);
        if (population !== undefined) parts.push(`${population.toLocaleString()} people in site grid`);
      }
      else if (site?.settings.latitude !== undefined && site.settings.longitude !== undefined) parts.push("Site location recorded");
      const actions = rc.protectiveActionParameters.protectiveActionsIncluded
        .filter((action) => action.included)
        .map((action) => action.action.toLowerCase().replace(/_/g, " "));
      if (actions.length) parts.push(actions.join(", "));
      break;
    }
    case "RCME": {
      const weather = rc.meteorologicalData.weatherInputs;
      if (weather?.data) parts.push(count(weather.data.recordCount, "weather record"));
      else if (weather?.collectionRequest) parts.push("Weather collection request saved");
      else if (rc.meteorologicalData.dataSource.trim()) parts.push("Weather source recorded");
      if (weather?.configurationFile) parts.push("Generation configuration supplied");
      if (weather?.trialSet) parts.push(`${count(weather.trialSet.trialCount, "weather trial")} · ${weatherTreatmentNames[weather.trialSet.mode]}`);
      break;
    }
    case "RCAD": {
      const dispersion = rc.atmosphericTransportAndDispersion;
      if (dispersion.transportInputs?.dispersionReference) parts.push("Dispersion reference imported");
      if (dispersion.dispersionModel.justification.trim()) {
        parts.push(dispersion.dispersionModel.name?.trim() || dispersion.dispersionModel.modelClass.replace(/_/g, " ").toLowerCase());
      }
      if (dispersion.deposition.dryDeposition.included) parts.push("Dry deposition");
      if (dispersion.deposition.wetDeposition.included) parts.push("Wet deposition");
      const decayCount = dispersion.transportInputs?.decayFiles.length ?? 0;
      if (decayCount) parts.push(count(decayCount, "decay file"));
      break;
    }
    case "RCDO": {
      const dose = rc.dosimetry;
      const exposureCount = dose.doseInputs?.categories.filter((category) => category.exposure).length ?? 0;
      if (exposureCount) parts.push(count(exposureCount, "exposure file"));
      const libraryCount = dose.doseInputs?.libraries.length ?? 0;
      if (libraryCount) parts.push(count(libraryCount, "coefficient library", "coefficient libraries"));
      const pathways = dose.exposurePathways.filter((pathway) => pathway.included).map((pathway) => pathway.pathway.toLowerCase().replace(/_/g, " "));
      if (pathways.length) parts.push(pathways.join(", "));
      break;
    }
    case "RCHE": {
      const effects = rc.healthEffects;
      if (effects.healthInput) parts.push(count(effects.healthInput.records.length, "health parameter record"));
      if (effects.earlyHealthEffects.some(effect => effect.trim())) parts.push(count(effects.earlyHealthEffects.filter(effect => effect.trim()).length, "early effect"));
      if (effects.latentHealthEffects.some(effect => effect.trim())) parts.push(count(effects.latentHealthEffects.filter(effect => effect.trim()).length, "latent effect"));
      if (effects.riskFactorSources.some(source => source.source.trim())) parts.push(count(effects.riskFactorSources.filter(source => source.source.trim()).length, "risk-factor source"));
      break;
    }
    case "RCEC": {
      const economics = rc.economicFactors;
      if (economics.siteEconomyInput) parts.push(`${economics.siteEconomyInput.regions.length} of ${economics.siteEconomyInput.expectedRegions} regional rows`);
      const costs = economics.costParameterEstimates.filter(row => row.value !== undefined);
      if (costs.length) parts.push(count(costs.length, "cost parameter"));
      const notes = economics.costCategories.filter(row => row.category.trim());
      if (notes.length) parts.push(count(notes.length, "category note"));
      break;
    }
    case "RCQ": {
      const quantification = rc.consequenceQuantification;
      const snapshots = quantification.caseRecords?.snapshots.length ?? 0;
      const results = quantification.caseRecords?.results.length ?? 0;
      if (snapshots) parts.push(count(snapshots, "input snapshot"));
      if (results) parts.push(count(results, "linked result"));
      if (quantification.eventSequenceConsequences.length) parts.push(count(quantification.eventSequenceConsequences.length, "event-sequence family", "event-sequence families"));
      break;
    }
  }
  return parts.join(" · ");
}
